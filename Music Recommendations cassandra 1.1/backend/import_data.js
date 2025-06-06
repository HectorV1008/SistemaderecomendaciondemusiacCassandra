// Importa los módulos necesarios para manejo de archivos, rutas, CSV y Cassandra
const fs = require('fs'); // Para leer archivos
const path = require('path'); // Para manejar rutas de archivos
const csv = require('csv-parser'); // Para parsear archivos CSV
const { client, setupKeyspaceAndTables } = require('./cassandra-setup'); // Cliente y setup de Cassandra

// Función genérica para importar un archivo CSV y esperar a que todas las inserciones terminen
function importCSV(filePath, insertRow) {
  return new Promise((resolve, reject) => {
    const promises = [];
    // Lee el archivo CSV y por cada fila ejecuta insertRow
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        promises.push(insertRow(row)); // Inserta cada fila en la base de datos
      })
      .on('end', async () => {
        try {
          await Promise.all(promises); // Espera a que todas las inserciones terminen
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject); // Maneja errores de lectura o parseo
  });
}

// Función principal para importar todos los datos
async function importData() {
  await setupKeyspaceAndTables(); // Asegura que el keyspace y las tablas existen

  // Importar datos de Usuarios
  const usuariosFile = path.join(__dirname, 'data', 'usuarios.csv'); // Ruta al CSV de usuarios
  await importCSV(usuariosFile, async (row) => {
    const query = 'INSERT INTO musicrec.usuarios (usuario_id, nombre, ciudad) VALUES (?, ?, ?)';
    await client.execute(query, [parseInt(row.usuario_id), row.nombre, row.ciudad], { prepare: true });
  });
  console.log("Usuarios importados.");

  // Importar datos de Canciones
  const cancionesFile = path.join(__dirname, 'data', 'canciones.csv'); // Ruta al CSV de canciones
  await importCSV(cancionesFile, async (row) => {
    const query = 'INSERT INTO musicrec.canciones (cancion_id, titulo, artista, genero) VALUES (?, ?, ?, ?)';
    await client.execute(query, [parseInt(row.cancion_id), row.titulo, row.artista, row.genero], { prepare: true });
  });
  console.log("Canciones importadas.");

  // Importar datos de Escuchas
  const escuchasFile = path.join(__dirname, 'data', 'escuchas.csv'); // Ruta al CSV de escuchas
  await importCSV(escuchasFile, async (row) => {
    const query = 'INSERT INTO musicrec.escuchas (usuario_id, fecha_escucha, cancion_id) VALUES (?, ?, ?)';

    // Convierte la fecha a objeto Date
    const fecha = new Date(row.fecha_escucha);
    await client.execute(query, [parseInt(row.usuario_id), fecha, parseInt(row.cancion_id)], { prepare: true });
  });
  console.log("Escuchas importadas.");

  // Termina el proceso cuando todo está listo
  process.exit(0);
}

// Ejecuta la importación al correr el script
importData();
