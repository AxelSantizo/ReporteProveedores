// Importación de librería de mysql
const mysql = require('mysql2');

// Se crea la constante connection que será el pool de conexiones a la base de datos
const connection = mysql.createPool({
    host: '50.6.171.160',
    database: 'qige86ho_nexus',
    user: 'axel', 
    password: 'bode.Sistemas1988!', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0 
});

// Testea la conexión (opcional, para verificar si la configuración es correcta)
connection.getConnection((err, conn) => {
    if (err) {
        console.error('No se pudo conectar a la base de datos:', err);
        return;
    }
    console.log('Conexión al pool de la base de datos exitosa');
    conn.release(); 
});

// Exporta la conexión para ser utilizada en otros archivos
module.exports = {
    connection
};
