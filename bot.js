
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch'); // Para descargar imágenes
const fs = require('fs'); // Para manejar archivos locales
const path = require('path'); // Para manejar rutas de archivos

// Lista de palabras similares para "adiós"
const adiosWords = ['adios', 'bye', 'chau', 'hasta luego', 'hasta la vista', 'nos vemos', 'see you'];

// Lista de palabras similares para "hola"
const holaWords = ['hola', 'oli', 'ola', 'buenas', 'buenos días', 'qué tal', 'hey'];

// Crear expresiones regulares combinadas para las palabras de "adiós" y "hola"
const adiosRegex = new RegExp(`\\b(${adiosWords.join('|')})\\b`, 'i');
const holaRegex = new RegExp(`\\b(${holaWords.join('|')})\\b`, 'i');

// Inicializar el cliente de WhatsApp Web
const client = new Client({
    authStrategy: new LocalAuth() // Utilizamos LocalAuth para guardar la sesión
});

// Función para verificar si el mensaje contiene alguna palabra de adiós
const containsGoodbye = (message) => {
    return adiosRegex.test(message);
};

// Función para verificar si el mensaje contiene alguna palabra de saludo
const containsHello = (message) => {
    return holaRegex.test(message);
};

// Función para enviar un mensaje de bienvenida si es un chat nuevo
const sendWelcomeMessage = async (message) => {
    const currentDate = new Date();
    const lastInteractionDate = new Date(message.timestamp * 1000);
    
    // Si la interacción fue en un día diferente, enviar mensaje de bienvenida
    if (currentDate.toDateString() !== lastInteractionDate.toDateString()) {
        await message.reply('¡Hola! Bienvenido nuevamente. ¿En qué puedo ayudarte hoy?');
    }
};

// Comando para convertir imágenes en stickers
const createSticker = async (message) => {
    if (message.hasMedia) {
        const media = await message.downloadMedia();
        const image = media.data; // Aquí tenemos la imagen en base64
        
        const imagePath = path.join(__dirname, 'temp_image.jpg'); // Ruta temporal para guardar la imagen

        // Guardar la imagen
        fs.writeFileSync(imagePath, Buffer.from(image, 'base64'));

        // Convertir la imagen a sticker usando WhatsApp Web JS
        const sticker = await client.sendMessage(message.from, fs.readFileSync(imagePath), {
            sendMediaAsSticker: true,
            stickerMetadata: { alt: 'Sticker' }
        });

        // Eliminar la imagen temporal
        fs.unlinkSync(imagePath);
    } else {
        message.reply('Por favor, envíame una imagen junto con el comando "/sticker".');
    }
};

// Generar el código QR cuando se inicie el bot
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este código QR en tu WhatsApp para autenticarte');
});

// Evento cuando el cliente está listo (conectado)
client.on('ready', () => {
    console.log('¡Bot está listo y conectado!');
});

// Responder a los mensajes entrantes
client.on('message', async (message) => {
    // Asegurarse de que solo responde en chats personales
    if (message.isGroupMsg) {
        console.log('El mensaje es de un grupo, no responderé.');
        return; // No responder en grupos
    }

    // Verificar si el mensaje es de despedida (adiós, bye, chau, etc.)
    if (containsGoodbye(message.body)) {
        message.reply('¡Adiós! ¡Hasta la próxima!');  // Responder de la misma forma
    }
    // Verificar si el mensaje es de saludo (hola, oli, ola, etc.)
    else if (containsHello(message.body)) {
        message.reply('¡Hola! Soy un bot de WhatsApp. ¿En qué puedo ayudarte?');
    }
    // Comando /sticker para crear stickers
    else if (message.body.startsWith('/sticker')) {
        await createSticker(message);
    } else {
        message.reply('Lo siento, no entiendo ese mensaje.');
    }

    // Enviar mensaje de bienvenida si es un chat nuevo
    await sendWelcomeMessage(message);
});

// Iniciar el cliente
client.initialize();
