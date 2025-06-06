# Funcion-ario: Explicación detallada del proyecto

## Descripción General
Este sistema es una aplicación web de recomendación de música que utiliza una base de datos NoSQL (Cassandra) y permite:
- Recomendar canciones personalizadas a los usuarios.
- Analizar escuchas por género y mes (OLAP simplificado).
- Insertar usuarios, canciones y escuchas desde la web.
- Cargar datos masivos desde archivos CSV.

## Estructura del Proyecto
- **docker-compose.yml**: Levanta Cassandra en un contenedor Docker.
- **backend/**: Código del servidor Node.js.
  - **index.js**: Lógica principal del backend y endpoints.
  - **cassandra-setup.js**: Configura el keyspace y las tablas en Cassandra.
  - **import_data.js**: Importa datos desde CSV a Cassandra.
  - **data/**: Archivos CSV de usuarios, canciones y escuchas.
- **frontend/**: Aplicación web (HTML, CSS, JS).
  - **index.html**: Interfaz de usuario.
  - **app.js**: Lógica de interacción con el backend.
  - **styles.css**: Estilos visuales.
- **docs/**: Documentación y diccionario de funciones.

## Backend (Node.js + Express)
- **Conexión a Cassandra**: Usa el driver oficial, crea el keyspace y las tablas si no existen.
- **Endpoints principales**:
  - `/recommendation`: Devuelve recomendaciones personalizadas según el usuario y el modo (por ciudad o por género favorito).
  - `/olap/genre-month`: Devuelve un análisis OLAP de escuchas agrupadas por género y mes.
  - `/usuario`, `/cancion`, `/escucha`: Permiten insertar usuarios, canciones y escuchas vía POST.
  - `/cargar-csv/:tipo`: Permite cargar datos masivos desde archivos CSV (usuarios, canciones o escuchas).
- **import_data.js**: Script para importar los datos iniciales desde los CSV a Cassandra.

## Frontend (HTML + JS + CSS)
- **index.html**: Contiene formularios para:
  - Obtener recomendaciones personalizadas (seleccionando modo).
  - Ver análisis OLAP.
  - Insertar usuarios, canciones y escuchas.
  - Cargar archivos CSV masivos.
- **app.js**: Maneja los eventos de los formularios, realiza peticiones al backend y muestra los resultados.
- **styles.css**: Da formato visual moderno y responsivo a la web.

## Flujo de Uso
1. **Despliegue**: Se levanta Cassandra con Docker y el backend con Node.js.
2. **Carga de datos**: Se pueden importar datos iniciales desde CSV o cargar nuevos desde la web.
3. **Interacción**: El usuario puede:
   - Consultar recomendaciones personalizadas.
   - Ver análisis OLAP.
   - Insertar nuevos datos manualmente o por CSV.

## Lógica de Recomendación
- **Por ciudad**: Recomienda las canciones más escuchadas por usuarios de la misma ciudad.
- **Por género favorito**: Recomienda las canciones más escuchadas del género que más escucha el usuario.

## OLAP Simplificado
- Permite ver la cantidad de escuchas agrupadas por género y mes, útil para análisis de tendencias.

## Seguridad y Buenas Prácticas
- Uso de CORS para permitir peticiones desde el frontend.
- Validación de datos en los endpoints.
- Manejo de errores y mensajes claros para el usuario.
