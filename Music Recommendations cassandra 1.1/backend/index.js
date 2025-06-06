// Importa los módulos necesarios para el backend
const express = require('express'); // Framework web para Node.js
const bodyParser = require('body-parser'); // Middleware para parsear JSON
const { client, setupKeyspaceAndTables } = require('./cassandra-setup'); // Cliente y setup de Cassandra
const cors = require('cors'); // Middleware para CORS
const multer = require('multer'); // Middleware para manejo de archivos
const csv = require('csv-parser'); // Parser de archivos CSV
const fs = require('fs'); // Módulo de sistema de archivos
const path = require('path'); // Módulo para rutas de archivos
const upload = multer({ dest: 'uploads/' }); // Configura multer para subir archivos a la carpeta uploads
const app = express(); // Crea la app de Express
const open = require('open').default;
/*
  Todas las queries a usuarios, canciones y escuchas ahora usan el prefijo musicrec.
*/
app.use(cors({
  origin: '*'
})); // Permite peticiones desde cualquier origen (CORS)
app.use(bodyParser.json()); // Permite recibir JSON en las peticiones
app.use(bodyParser.urlencoded({ extended: true })); // Permite recibir datos de formularios

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos del frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Ruta para servir index.html en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Inicializa Cassandra y arranca el servidor
async function startServer() {
  await setupKeyspaceAndTables(); // Crea keyspace y tablas si no existen
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
    // Abrir el navegador automáticamente al iniciar el backend
    open(`http://localhost:${PORT}`);
  });
}
startServer();

// --- Endpoint de recomendación personalizada ---
// Devuelve recomendaciones según ciudad o género favorito del usuario
app.get('/recommendation', async (req, res) => {
  try {
    const usuarioId = parseInt(req.query.usuario_id); // ID del usuario
    const modo = req.query.modo || 'ciudad'; // Modo de recomendación
    if (isNaN(usuarioId)) {
      return res.status(400).json({ error: 'usuario_id debe ser un número' });
    }
    if (modo === 'ciudad') {
      // --- RECOMENDACIÓN POR CIUDAD ---
      // 1. Obtiene la ciudad del usuario
      const userQuery = 'SELECT ciudad FROM musicrec.usuarios WHERE usuario_id = ?';
      const userResult = await client.execute(userQuery, [usuarioId], { prepare: true });
      if (userResult.rowLength === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const ciudad = userResult.rows[0].ciudad;
      // 2. Busca todos los usuarios de la misma ciudad
      const allUsersQuery = 'SELECT usuario_id, ciudad FROM musicrec.usuarios';
      const allUsersResult = await client.execute(allUsersQuery);
      const matchingUsers = allUsersResult.rows
        .filter(u => u.ciudad === ciudad)
        .map(u => u.usuario_id);
      // 3. Cuenta las escuchas de los usuarios de esa ciudad
      let songCounts = {};
      for (let uid of matchingUsers) {
        const escuchaQuery = 'SELECT cancion_id FROM musicrec.escuchas WHERE usuario_id = ?';
        const escuchaResult = await client.execute(escuchaQuery, [uid], { prepare: true });
        escuchaResult.rows.forEach(row => {
          songCounts[row.cancion_id] = (songCounts[row.cancion_id] || 0) + 1;
        });
      }
      // 4. Ordena y selecciona las 5 canciones más escuchadas
      const sortedSongs = Object.entries(songCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      let recommendations = [];
      for (let [cancion_id, count] of sortedSongs) {
        const songQuery = 'SELECT titulo, artista, genero FROM musicrec.canciones WHERE cancion_id = ?';
        const songResult = await client.execute(songQuery, [parseInt(cancion_id)], { prepare: true });
        if (songResult.rowLength > 0) {
          recommendations.push({
            cancion_id: cancion_id,
            titulo: songResult.rows[0].titulo,
            artista: songResult.rows[0].artista,
            genero: songResult.rows[0].genero,
            listens: count
          });
        }
      }
      return res.json({ recommendations }); // Devuelve las recomendaciones por ciudad
    } else if (modo === 'genero') {
      // --- RECOMENDACIÓN POR GÉNERO FAVORITO ---
      // 1. Obtiene todas las escuchas del usuario
      const escuchasQuery = 'SELECT cancion_id FROM musicrec.escuchas WHERE usuario_id = ?';
      const escuchasResult = await client.execute(escuchasQuery, [usuarioId], { prepare: true });
      if (escuchasResult.rowLength === 0) {
        return res.status(404).json({ error: 'El usuario no tiene escuchas registradas' });
      }
      // 2. Cuenta cuántas veces escuchó cada género
      let genreCounts = {};
      for (let row of escuchasResult.rows) {
        const cancionId = row.cancion_id;
        const songQuery = 'SELECT genero FROM musicrec.canciones WHERE cancion_id = ?';
        const songResult = await client.execute(songQuery, [cancionId], { prepare: true });
        if (songResult.rowLength > 0) {
          const genero = songResult.rows[0].genero;
          genreCounts[genero] = (genreCounts[genero] || 0) + 1;
        }
      }
      // 3. Encuentra el género favorito
      const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!favoriteGenre) {
        return res.status(404).json({ error: 'No se pudo determinar el género favorito' });
      }
      // 4. Busca todas las escuchas de ese género (de todos los usuarios)
      const allEscuchasQuery = 'SELECT cancion_id FROM musicrec.escuchas';
      const allEscuchasResult = await client.execute(allEscuchasQuery);
      let songCounts = {};
      for (let row of allEscuchasResult.rows) {
        const cancionId = row.cancion_id;
        const songQuery = 'SELECT genero FROM musicrec.canciones WHERE cancion_id = ?';
        const songResult = await client.execute(songQuery, [cancionId], { prepare: true });
        if (songResult.rowLength > 0 && songResult.rows[0].genero === favoriteGenre) {
          songCounts[cancionId] = (songCounts[cancionId] || 0) + 1;
        }
      }
      // 5. Ordena y selecciona las 5 canciones más escuchadas de ese género
      const sortedSongs = Object.entries(songCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      let recommendations = [];
      for (let [cancion_id, count] of sortedSongs) {
        const songQuery = 'SELECT titulo, artista, genero FROM musicrec.canciones WHERE cancion_id = ?';
        const songResult = await client.execute(songQuery, [parseInt(cancion_id)], { prepare: true });
        if (songResult.rowLength > 0) {
          recommendations.push({
            cancion_id: cancion_id,
            titulo: songResult.rows[0].titulo,
            artista: songResult.rows[0].artista,
            genero: songResult.rows[0].genero,
            listens: count
          });
        }
      }
      return res.json({ recommendations, genero_favorito: favoriteGenre }); // Devuelve las recomendaciones por género
    } else {
      return res.status(400).json({ error: 'Modo de recomendación no válido' });
    }
  } catch (err) {
    console.error("Error en /recommendation: ", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Endpoint OLAP: escuchas por género y mes ---
// Devuelve un análisis de escuchas agrupadas por género y mes
app.get('/olap/genre-month', async (req, res) => {
  try {
    const escuchasQuery = 'SELECT usuario_id, cancion_id, fecha_escucha FROM musicrec.escuchas';
    const escuchasResult = await client.execute(escuchasQuery, [], { prepare: true });
    // Mapea cancion_id a género
    const songsQuery = 'SELECT cancion_id, genero FROM musicrec.canciones';
    const songsResult = await client.execute(songsQuery, [], { prepare: true });
    let songGenreMap = {};
    songsResult.rows.forEach(row => {
      songGenreMap[row.cancion_id] = row.genero;
    });
    let aggregation = {};
    // Agrupa escuchas por género y mes
    escuchasResult.rows.forEach(row => {
      const fecha = new Date(row.fecha_escucha);
      const month = `${fecha.getFullYear()}-${("0" + (fecha.getMonth() + 1)).slice(-2)}`;
      const genero = songGenreMap[row.cancion_id] || 'Desconocido';
      const key = `${genero}_${month}`;
      aggregation[key] = (aggregation[key] || 0) + 1;
    });
    let resultArray = [];
    for (let key in aggregation) {
      const [genero, month] = key.split('_');
      resultArray.push({ genero, month, listens: aggregation[key] });
    }
    res.json({ olap: resultArray }); // Devuelve el análisis OLAP
  } catch (err) {
    console.error("Error en /olap/genre-month: ", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Endpoint OLAP: escuchas por género y mes y ciudad ---
// Devuelve un análisis de escuchas agrupadas por género, mes y ciudad
app.get('/olap/genre-month-city', async (req, res) => {
  try {
    // 1. Obtener escuchas con usuario_id, cancion_id, fecha_escucha
    const escuchasQuery = 'SELECT usuario_id, cancion_id, fecha_escucha FROM musicrec.escuchas';
    const escuchasResult = await client.execute(escuchasQuery, [], { prepare: true });
    // 2. Mapear cancion_id a género
    const songsQuery = 'SELECT cancion_id, genero FROM musicrec.canciones';
    const songsResult = await client.execute(songsQuery, [], { prepare: true });
    let songGenreMap = {};
    songsResult.rows.forEach(row => {
      songGenreMap[row.cancion_id] = row.genero;
    });
    // 3. Mapear usuario_id a ciudad
    const usersQuery = 'SELECT usuario_id, ciudad FROM musicrec.usuarios';
    const usersResult = await client.execute(usersQuery, [], { prepare: true });
    let userCityMap = {};
    usersResult.rows.forEach(row => {
      userCityMap[row.usuario_id] = row.ciudad;
    });
    // 4. Agrupar escuchas por género, mes y ciudad
    let aggregation = {};
    escuchasResult.rows.forEach(row => {
      const fecha = new Date(row.fecha_escucha);
      const month = `${fecha.getFullYear()}-${("0" + (fecha.getMonth() + 1)).slice(-2)}`;
      const genero = songGenreMap[row.cancion_id] || 'Desconocido';
      const ciudad = userCityMap[row.usuario_id] || 'Desconocido';
      const key = `${genero}_${month}_${ciudad}`;
      aggregation[key] = (aggregation[key] || 0) + 1;
    });
    // 5. Convertir a array de objetos
    let resultArray = [];
    for (let key in aggregation) {
      const [genero, month, ciudad] = key.split('_');
      resultArray.push({ genero, month, ciudad, listens: aggregation[key] });
    }
    res.json({ olap: resultArray });
  } catch (err) {
    console.error("Error en /olap/genre-month-city: ", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Endpoint de verificación ---
// Permite comprobar si el backend está corriendo
app.get('/health', (req, res) => {
  res.send('OK');
});

// --- Scripts de utilidad ---
// Permiten iniciar el servidor o importar datos desde package.json
const scripts = {
  start: "node index.js",
  import: "node import_data.js"
};

// --- Endpoint para insertar un usuario ---
// Permite agregar un usuario desde el frontend o por API
app.post('/usuario', async (req, res) => {
  try {
    const { usuario_id, nombre, ciudad } = req.body;
    if (!usuario_id || !nombre || !ciudad) {
      return res.status(400).json({ error: 'Faltan datos para el usuario' });
    }
    const query = 'INSERT INTO musicrec.usuarios (usuario_id, nombre, ciudad) VALUES (?, ?, ?)';
    await client.execute(query, [parseInt(usuario_id), nombre, ciudad], { prepare: true });
    res.json({ mensaje: 'Usuario insertado correctamente' });
  } catch (err) {
    console.error('Error al insertar usuario:', err);
    res.status(500).json({ error: 'Error al insertar usuario' });
  }
});

// --- Endpoint para insertar una canción ---
// Permite agregar una canción desde el frontend o por API
app.post('/cancion', async (req, res) => {
  try {
    const { cancion_id, titulo, artista, genero } = req.body;
    if (!cancion_id || !titulo || !artista || !genero) {
      return res.status(400).json({ error: 'Faltan datos para la canción' });
    }
    const query = 'INSERT INTO musicrec.canciones (cancion_id, titulo, artista, genero) VALUES (?, ?, ?, ?)';
    await client.execute(query, [parseInt(cancion_id), titulo, artista, genero], { prepare: true });
    res.json({ mensaje: 'Canción insertada correctamente' });
  } catch (err) {
    console.error('Error al insertar canción:', err);
    res.status(500).json({ error: 'Error al insertar canción' });
  }
});

// --- Endpoint para insertar una escucha ---
// Permite agregar una escucha desde el frontend o por API
app.post('/escucha', async (req, res) => {
  try {
    const { usuario_id, cancion_id, fecha_escucha } = req.body;
    if (!usuario_id || !cancion_id || !fecha_escucha) {
      return res.status(400).json({ error: 'Faltan datos para la escucha' });
    }
    const fecha = new Date(fecha_escucha);
    const query = 'INSERT INTO musicrec.escuchas (usuario_id, fecha_escucha, cancion_id) VALUES (?, ?, ?)';
    await client.execute(query, [parseInt(usuario_id), fecha, parseInt(cancion_id)], { prepare: true });
    res.json({ mensaje: 'Escucha insertada correctamente' });
  } catch (err) {
    console.error('Error al insertar escucha:', err);
    res.status(500).json({ error: 'Error al insertar escucha' });
  }
});

// --- Endpoint para carga masiva de CSV ---
// Permite cargar usuarios, canciones o escuchas desde un archivo CSV
app.post('/cargar-csv/:tipo', upload.single('csv'), async (req, res) => {
  const tipo = req.params.tipo; // Tipo de datos a cargar
  const filePath = req.file.path; // Ruta temporal del archivo
  let insertQuery, insertFn;
  try {
    if (tipo === 'usuarios') {
      insertQuery = 'INSERT INTO musicrec.usuarios (usuario_id, nombre, ciudad) VALUES (?, ?, ?)';
      insertFn = row => client.execute(insertQuery, [parseInt(row.usuario_id), row.nombre, row.ciudad], { prepare: true });
    } else if (tipo === 'canciones') {
      insertQuery = 'INSERT INTO musicrec.canciones (cancion_id, titulo, artista, genero) VALUES (?, ?, ?, ?)';
      insertFn = row => client.execute(insertQuery, [parseInt(row.cancion_id), row.titulo, row.artista, row.genero], { prepare: true });
    } else if (tipo === 'escuchas') {
      insertQuery = 'INSERT INTO musicrec.escuchas (usuario_id, fecha_escucha, cancion_id) VALUES (?, ?, ?)';

      insertFn = row => client.execute(insertQuery, [parseInt(row.usuario_id), new Date(row.fecha_escucha), parseInt(row.cancion_id)], { prepare: true });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Tipo de datos no válido' });
    }
    const promises = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', row => promises.push(insertFn(row)))
      .on('end', async () => {
        try {
          await Promise.all(promises);
          fs.unlinkSync(filePath);
          res.json({ mensaje: 'Datos cargados correctamente.' });
        } catch (err) {
          fs.unlinkSync(filePath);
          res.status(500).json({ error: 'Error al insertar datos.' });
        }
      })
      .on('error', err => {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Error al procesar el archivo.' });
      });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
