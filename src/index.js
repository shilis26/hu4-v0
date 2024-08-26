import pkg from 'pg';
import fetch from 'node-fetch';

// Configuración de la conexión a PostgreSQL
const pool = new pkg.Pool({
  user: 'db_gym_render_user',
  host: 'dpg-cr5568ij1k6c73934m10-a.oregon-postgres.render.com',
  database: 'db_gym_render',
  password: 'LusVdIcmARRFj7nY76BbOj9MzQ2Y33I5',
  port: 5432,
  ssl: {
    rejectUnauthorized: false 
  }
});

// Extrae datos del cuerpo de la solicitud

export const handler = async (event) => {
  const { 
    name, 
    surname_father, 
    surname_mother, 
    mail, 
    phone, 
    document, 
    password, 
    photo, 
    gender, 
    code, 
    city, 
    address, 
    country, 
    postal_code,
    emergency_contact 
  } = JSON.parse(event.body);

  const client = await pool.connect();

  try {
 // Solicitar datos a la API de RENIEC
    const apiUrl = `https://apiperu.dev/api/dni/${document}?api_token=9ae0564c33d656544c4c2fc78b7678b0fd28e4ffc4e4c8e305b02b4d57aacad1`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error al consultar la API de RENIEC: ${response.statusText}`);
    }

    const data = await response.json();
    const reniecData = {
      dni: data.data.numero,
      nombres: data.data.nombres,
      apellido_paterno: data.data.apellido_paterno,
      apellido_materno: data.data.apellido_materno,
      direccion: address || '', // Si no se proporciona, se deja vacío
      genero: gender || '',    
      ciudad: city || '',    
      distrito: '' // Se deja vacío si no se proporciona
    };

// Iniciar transacción
    await client.query('BEGIN');

// Insertar usuario en t_users
    const userQuery = `
      INSERT INTO t_users (mail, password, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING user_id;
    `;
    const userValues = [mail, password];
    const userResult = await client.query(userQuery, userValues);
    const userId = userResult.rows[0].user_id;

// Insertar datos en t_clients utilizando datos de la API de RENIEC
    const clientQuery = `
      INSERT INTO t_clients (user_id, document, name, entry_date, membership_start_date, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW(), NOW(), NOW())
      RETURNING client_id;
    `;
    const clientValues = [
      userId, 
      reniecData.dni, 
      reniecData.nombres + ' ' + reniecData.apellido_paterno + ' ' + reniecData.apellido_materno
    ];
    await client.query(clientQuery, clientValues);
    
 // Confirmar transacción
    await client.query('COMMIT');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Cliente registrado exitosamente.' })
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando cliente:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error registrando cliente.', error: error.message })
    };
  } finally {
    client.release();
  }
};
