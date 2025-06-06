# Sistema de Recomendación de Música con Análisis OLAP Simplificado

## Descripción
Este proyecto implementa un sistema básico de recomendación de música utilizando una base de datos NoSQL (Apache Cassandra) alojada en un contenedor Docker. Además, se realizan análisis OLAP simplificados que agrupan las escuchas por género y mes.

## Estructura del Proyecto
music-recommendation-project/ 
    ├── docker-compose.yml 
    ├── backend/
    │   ├── Dockerfile 
    │   ├── package.json 
    │   ├── index.js 
    │   ├── cassandra-setup.js 
    │   ├── import_data.js 
    │   └── data/ 
    │       ├── canciones.csv 
    │       ├── usuarios.csv 
    │       └── escuchas.csv 
    ├── frontend/
    │   ├── index.html 
    │   ├── app.js 
    │   └── styles.css 
    └── README.md
        └── docs/ 

## Requisitos
- Docker y Docker Compose instalados.
- Node.js.

## Instrucciones de Despliegue
Pasos para ejecutar el proyecto:

1. Abrir PowerShell en la carpeta del proyecto y ejecuta:
    docker-compose up -d
Esto levantará Cassandra en un contenedor.

2. Para el backend:
Ir a la carpeta backend:
    cd backend

Instala dependencias (solo la primera vez):
    npm install
    npm install open

Importar los datos (solo la primera vez o cuando cambies los CSV):
    npm run import

Iniciar el backend:
    npm start

3. Para el frontend:
Ir a la carpeta frontend:
    cd ../frontend
Abrir el archivo index.html en tu navegador (doble clic o con start index.html).
