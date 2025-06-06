const cassandra = require('cassandra-driver');

const keyspace = 'musicrec';

// Cliente SIN keyspace para crear el keyspace
const client = new cassandra.Client({
  contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
  localDataCenter: 'datacenter1'
});

async function setupKeyspaceAndTables() {
  try {
    // Crear keyspace si no existe
    const createKeyspaceQuery = `
      CREATE KEYSPACE IF NOT EXISTS ${keyspace}
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
    `;
    await client.execute(createKeyspaceQuery);

    // Crear tablas usando el keyspace explícitamente
    const queryUsuarios = `
      CREATE TABLE IF NOT EXISTS ${keyspace}.usuarios (
        usuario_id int PRIMARY KEY,
        nombre text,
        ciudad text
      );
    `;
    await client.execute(queryUsuarios);

    const queryCanciones = `
      CREATE TABLE IF NOT EXISTS ${keyspace}.canciones (
        cancion_id int PRIMARY KEY,
        titulo text,
        artista text,
        genero text
      );
    `;
    await client.execute(queryCanciones);

    const queryEscuchas = `
      CREATE TABLE IF NOT EXISTS ${keyspace}.escuchas (
        usuario_id int,
        fecha_escucha date,
        cancion_id int,
        PRIMARY KEY (usuario_id, fecha_escucha, cancion_id)
      );
    `;
    await client.execute(queryEscuchas);

    console.log("Keyspace y tablas creadas correctamente.");
  } catch (err) {
    console.error("Error al configurar keyspace y tablas: ", err);
  }
}

// Exporta el cliente y la función
module.exports = { client, setupKeyspaceAndTables, keyspace };