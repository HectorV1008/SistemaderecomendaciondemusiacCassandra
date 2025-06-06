// URL base del backend donde se hacen todas las peticiones
const backendUrl = 'http://localhost:3000';

// Evento para el formulario de recomendaciones personalizadas
// Cuando el usuario envía el formulario de recomendación:
document.getElementById('recommendation-form').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evita que el formulario recargue la página
  const usuarioId = document.getElementById('usuario_id').value; // Obtiene el ID de usuario
  const modo = document.getElementById('modo_recomendacion').value; // Obtiene el modo de recomendación
  const resultDiv = document.getElementById('recommendation-result'); // Div donde se muestran los resultados
  resultDiv.innerHTML = 'Cargando recomendaciones...'; // Mensaje de carga
  
  try {
    // Solicita recomendaciones al backend según usuario y modo
    const response = await fetch(`${backendUrl}/recommendation?usuario_id=${usuarioId}&modo=${modo}`);
    const data = await response.json(); // Convierte la respuesta a JSON
    if (data.error) {
      // Si hay error, lo muestra
      resultDiv.innerHTML = `<p>Error: ${data.error}</p>`;
    } else {
      // Si hay recomendaciones, las muestra en una lista
      let html = '<h3>Recomendaciones:</h3><ul>';
      data.recommendations.forEach(rec => {
        // Si el modo es ciudad, muestra "Escuchas en tu ciudad"
        if (modo === 'ciudad') {
          html += `<li>${rec.titulo} - ${rec.artista} (Género: ${rec.genero}, Escuchas en tu ciudad: ${rec.listens})</li>`;
        } else {
          html += `<li>${rec.titulo} - ${rec.artista} (Género: ${rec.genero}, Escuchas: ${rec.listens})</li>`;
        }
      });
      html += '</ul>';
      resultDiv.innerHTML = html;
    }
  } catch (err) {
    // Si falla la conexión, muestra error
    resultDiv.innerHTML = `<p>Error al conectar al backend.</p>`;
  }
});

// --- Visualización OLAP 2D: Género/Mes/Ciudad ---
document.getElementById('fetch-olap').addEventListener('click', async () => {
  const olapDiv = document.getElementById('olap-result');
  olapDiv.innerHTML = 'Cargando análisis OLAP...';
  try {
    // Solicita el análisis OLAP 2D al backend
    const response = await fetch(`${backendUrl}/olap/genre-month-city`);
    const data = await response.json();
    if (data.error) {
      olapDiv.innerHTML = `<p>Error: ${data.error}</p>`;
    } else {
      // Agrupar por ciudad para mostrar un gráfico por ciudad
      const grouped = {};
      data.olap.forEach(item => {
        if (!grouped[item.ciudad]) grouped[item.ciudad] = [];
        grouped[item.ciudad].push(item);
      });
      // Ordenar por mes (fecha) y luego por género
      Object.keys(grouped).forEach(ciudad => {
        grouped[ciudad].sort((a, b) => {
          // Primero por mes (YYYY-MM)
          if (a.month < b.month) return -1;
          if (a.month > b.month) return 1;
          // Si el mes es igual, por género alfabético
          if (a.genero < b.genero) return -1;
          if (a.genero > b.genero) return 1;
          return 0;
        });
      });
      // Crear un gráfico simple por ciudad usando canvas
      let html = '';
      Object.keys(grouped).forEach(ciudad => {
        html += `<h4>${ciudad}</h4><canvas id="chart-${ciudad}" width="500" height="250"></canvas>`;
      });
      olapDiv.innerHTML = html;
      // Dibujar los gráficos
      Object.keys(grouped).forEach(ciudad => {
        const canvas = document.getElementById(`chart-${ciudad}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        // Eje X: Mes-Género, Eje Y: escuchas
        const labels = grouped[ciudad].map(item => `${item.month}\n${item.genero}`);
        const values = grouped[ciudad].map(item => item.listens);
        // Escalado
        const max = Math.max(...values, 1);
        const barWidth = Math.max(20, 400 / values.length);
        ctx.clearRect(0, 0, 500, 250);
        // Dibujar barras
        values.forEach((v, i) => {
          ctx.fillStyle = '#4a90e2';
          ctx.fillRect(40 + i * barWidth, 200 - (v / max) * 180, barWidth - 4, (v / max) * 180);
          // Mostrar valor encima de la barra
          ctx.fillStyle = '#333';
          ctx.font = '10px Arial';
          ctx.fillText(v, 40 + i * barWidth, 195 - (v / max) * 180);
        });
        // Dibujar etiquetas de género y mes debajo de cada barra, sin rotar y con salto de línea
        labels.forEach((label, i) => {
          const [mes, genero] = label.split('\n');
          ctx.save();
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#222';
          ctx.fillText(mes, 40 + i * barWidth + (barWidth - 4) / 2, 215);
          ctx.fillStyle = '#e26a4a';
          ctx.font = 'bold 11px Arial';
          ctx.fillText(genero, 40 + i * barWidth + (barWidth - 4) / 2, 230);
          ctx.restore();
        });
        // Ejes
        ctx.beginPath();
        ctx.moveTo(35, 200);
        ctx.lineTo(480, 200);
        ctx.moveTo(40, 200);
        ctx.lineTo(40, 20);
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.font = '12px Arial';
        ctx.fillText('Escuchas', 5, 30);
      });
    }
  } catch (err) {
    olapDiv.innerHTML = `<p>Error al conectar al backend.</p>`;
  }
});

// --- Insertar Usuario ---
// Evento para el formulario de nuevo usuario
document.getElementById('insert-usuario-form').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evita recarga
  const usuario_id = document.getElementById('nuevo_usuario_id').value; // ID usuario
  const nombre = document.getElementById('nuevo_usuario_nombre').value; // Nombre
  const ciudad = document.getElementById('nuevo_usuario_ciudad').value; // Ciudad
  const resultDiv = document.getElementById('insert-usuario-result'); // Div resultado
  resultDiv.innerHTML = 'Insertando...'; // Mensaje de carga
  try {
    // Envía los datos al backend por POST
    const response = await fetch(`${backendUrl}/usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, nombre, ciudad })
    });
    const data = await response.json(); // Respuesta JSON
    if (data.error) {
      // Muestra error si ocurre
      resultDiv.innerHTML = `<p style='color:red;'>Error: ${data.error}</p>`;
    } else {
      // Muestra éxito
      resultDiv.innerHTML = `<p style='color:green;'>${data.mensaje}</p>`;
    }
  } catch (err) {
    // Error de conexión
    resultDiv.innerHTML = `<p style='color:red;'>Error al conectar al backend.</p>`;
  }
});

// --- Insertar Canción ---
// Evento para el formulario de nueva canción
document.getElementById('insert-cancion-form').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evita recarga
  const cancion_id = document.getElementById('nueva_cancion_id').value; // ID canción
  const titulo = document.getElementById('nueva_cancion_titulo').value; // Título
  const artista = document.getElementById('nueva_cancion_artista').value; // Artista
  const genero = document.getElementById('nueva_cancion_genero').value; // Género
  const resultDiv = document.getElementById('insert-cancion-result'); // Div resultado
  resultDiv.innerHTML = 'Insertando...'; // Mensaje de carga
  try {
    // Envía los datos al backend por POST
    const response = await fetch(`${backendUrl}/cancion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancion_id, titulo, artista, genero })
    });
    const data = await response.json(); // Respuesta JSON
    if (data.error) {
      // Muestra error si ocurre
      resultDiv.innerHTML = `<p style='color:red;'>Error: ${data.error}</p>`;
    } else {
      // Muestra éxito
      resultDiv.innerHTML = `<p style='color:green;'>${data.mensaje}</p>`;
    }
  } catch (err) {
    // Error de conexión
    resultDiv.innerHTML = `<p style='color:red;'>Error al conectar al backend.</p>`;
  }
});

// --- Insertar Escucha ---
// Evento para el formulario de nueva escucha
document.getElementById('insert-escucha-form').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evita recarga
  const usuario_id = document.getElementById('nueva_escucha_usuario_id').value; // ID usuario
  const cancion_id = document.getElementById('nueva_escucha_cancion_id').value; // ID canción
  const fecha_escucha = document.getElementById('nueva_escucha_fecha').value; // Fecha
  const resultDiv = document.getElementById('insert-escucha-result'); // Div resultado
  resultDiv.innerHTML = 'Insertando...'; // Mensaje de carga
  try {
    // Envía los datos al backend por POST
    const response = await fetch(`${backendUrl}/escucha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, cancion_id, fecha_escucha })
    });
    const data = await response.json(); // Respuesta JSON
    if (data.error) {
      // Muestra error si ocurre
      resultDiv.innerHTML = `<p style='color:red;'>Error: ${data.error}</p>`;
    } else {
      // Muestra éxito
      resultDiv.innerHTML = `<p style='color:green;'>${data.mensaje}</p>`;
    }
  } catch (err) {
    // Error de conexión
    resultDiv.innerHTML = `<p style='color:red;'>Error al conectar al backend.</p>`;
  }
});

// --- Carga masiva de CSV ---
// Evento para el formulario de carga de CSV
document.getElementById('csv-upload-form').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evita recarga
  const tipo = document.getElementById('csv-type').value; // Tipo de datos a cargar
  const fileInput = document.getElementById('csv-file'); // Input de archivo
  const resultDiv = document.getElementById('csv-upload-result'); // Div resultado
  if (!fileInput.files.length) {
    // Si no hay archivo seleccionado, muestra error
    resultDiv.innerHTML = '<p style="color:red;">Selecciona un archivo CSV.</p>';
    return;
  }
  const file = fileInput.files[0]; // Archivo seleccionado
  const formData = new FormData();
  formData.append('csv', file); // Agrega el archivo al formData
  try {
    // Envía el archivo al backend por POST
    const response = await fetch(`${backendUrl}/cargar-csv/${tipo}`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json(); // Respuesta JSON
    if (data.error) {
      // Muestra error si ocurre
      resultDiv.innerHTML = `<p style='color:red;'>Error: ${data.error}</p>`;
    } else {
      // Muestra éxito
      resultDiv.innerHTML = `<p style='color:green;'>${data.mensaje}</p>`;
    }
  } catch (err) {
    // Error de conexión
    resultDiv.innerHTML = `<p style='color:red;'>Error al conectar al backend.</p>`;
  }
});
