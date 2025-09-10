// Importar los módulos necesarios
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
// Cargar variables de entorno desde el archivo .env
require("dotenv").config();

// Inicializar la aplicación Express
const app = express();
// Definir el puerto del servidor, usando el de las variables de entorno o 10000 por defecto
const PORT = process.env.PORT || 000;

// --- Middlewares ---

// Habilitar JSON body parser para leer datos en formato JSON de las peticiones
app.use(express.json());
// Habilitar Cross-Origin Resource Sharing (CORS) para permitir peticiones desde otros dominios
app.use(cors());
// Añadir cabeceras de seguridad HTTP con Helmet
app.use(helmet());
// Registrar las peticiones HTTP en la consola en formato 'combined'
app.use(morgan("combined"));

// Configurar el limitador de peticiones para prevenir ataques de fuerza bruta o spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limitar cada IP a 100 peticiones por ventana de tiempo
  standardHeaders: true, // Devolver información del límite en las cabeceras `RateLimit-*`
  legacyHeaders: false, // Deshabilitar las cabeceras `X-RateLimit-*`
});
// Aplicar el limitador de peticiones a todas las rutas
app.use(limiter);

// --- Rutas ---

// Ruta de comprobación de estado (Health Check)
// Es una buena práctica tener una ruta para verificar que el servicio está funcionando
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is healthy" });
});

// Ruta principal para interactuar con el chat de OpenAI
app.post("/chat", async (req, res) => {
  // Extraer el mensaje y el historial de la conversación del cuerpo de la petición
  // Permitir un historial ayuda a que el chat tenga contexto
  const { message, history = [] } = req.body;

  // --- Validación de la entrada ---
  // Se comprueba que el mensaje no esté vacío o solo contenga espacios en blanco
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "El mensaje es inválido o está vacío." });
  }

  try {
    // --- Construcción del cuerpo de la petición a OpenAI ---
    // Se combina el historial previo con el nuevo mensaje del usuario
    const messages = [
        ...history,
        { role: "user", content: message.trim() }
    ];

    // --- Petición a la API de OpenAI ---
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        // Usar el modelo desde una variable de entorno para mayor flexibilidad
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          // La API Key se obtiene de las variables de entorno para mayor seguridad
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const answer = response.data.choices[0].message.content;
    res.json({ answer });

  } catch (error) {
    // --- Manejo de errores mejorado ---
    // Se registra el error completo para facilitar la depuración
    console.error("Error al contactar con OpenAI:", error.response ? error.response.data : error.message);

    // Devolver un mensaje de error más genérico al cliente para no exponer detalles internos
    res.status(500).json({ error: "Ocurrió un error al procesar tu solicitud." });
  }
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
