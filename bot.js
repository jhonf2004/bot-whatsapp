const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require("openai");

const adiosWords = ['adios', 'bye', 'chau', 'hasta luego', 'hasta la vista', 'nos vemos', 'see you', 'Adiós'];
const holaWords = ['hola', 'oli', 'ola', 'buenas', 'buenos días', 'qué tal', 'hey', 'holis', 'Jhon', 'JHONNN', 'JHON'];

const adiosRegex = new RegExp(`\\b(${adiosWords.join('|')})\\b`, 'i');
const holaRegex = new RegExp(`\\b(${holaWords.join('|')})\\b`, 'i');

const client = new Client({
    authStrategy: new LocalAuth()
});

// Configuración de la API de AIML
const AIML_API_KEY = 'TU KEY API AQUI'; 
const baseURL = "https://api.aimlapi.com/v1";


const aimlClient = new OpenAI({
    apiKey: AIML_API_KEY,
    baseURL: baseURL,
});

// Función con AIML API
async function processWithAI(messageText) {
    try {
        const completion = await aimlClient.chat.completions.create({
            model: "mistralai/Mistral-7B-Instruct-v0.2",
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente programado por JF (Jhon) y respondes sus chats que le escriben en español."
                },
                {
                    role: "user",
                    content: messageText
                }
            ],
            temperature: 0.7,
            max_tokens: 256
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error con la API de AIML:', error.response || error);
        return "Lo siento, tuve un problema procesando tu solicitud.";
    }
}

const comandos = {
    "/sticker": "Convierte una imagen en sticker.",
    "/cmds": "Muestra la lista de comandos disponibles.",
    "/ai": "Activa el modo IA. Pregúntame lo que quieras."
};

const containsGoodbye = (message) => {
    return adiosRegex.test(message);
};

const containsHello = (message) => {
    return holaRegex.test(message);
};

const sendWelcomeMessage = async (message) => {
    const currentDate = new Date();
    const lastInteractionDate = new Date(message.timestamp * 1000);
    
    if (currentDate.toDateString() !== lastInteractionDate.toDateString()) {
        await message.reply('¡Hola! Bienvenido nuevamente. ¿En qué puedo ayudarte hoy?');
    }
};

const createSticker = async (message) => {
    if (message.hasMedia) {
        const media = await message.downloadMedia();
        const image = media.data;
        
        const imagePath = path.join(__dirname, 'temp_image.jpg');
        fs.writeFileSync(imagePath, Buffer.from(image, 'base64'));

        const sticker = await client.sendMessage(message.from, fs.readFileSync(imagePath), {
            sendMediaAsSticker: true,
            stickerMetadata: { alt: 'Sticker' }
        });

        fs.unlinkSync(imagePath);
    } else {
        message.reply('Por favor, envíame una imagen junto con el comando "/sticker".');
    }
};

const showCommands = async (message) => {
        let commandList = "📋 *Lista de Comandos Disponibles*:\n/stickers ";
    
    for (const [cmd, desc] of Object.entries(comandos)) {
        commandList += `*${cmd}*: ${desc}\n`;
    }
    
    await message.reply(commandList);
};

// Para manejar el modo AI
let aiModeUsers = {};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este código QR en tu WhatsApp para autenticarte');
});

client.on('ready', () => {
    console.log('¡Bot está listo y conectado!');
    // Guardar el ID del bot para futuras referencias
    global.botId = client.info.wid._serialized;
    console.log(`ID del bot: ${global.botId}`);
});

client.on('message', async (message) => {
    console.log('Mensaje recibido:', {
        from: message.from,
        author: message.author || 'N/A',
        body: message.body,
        type: message.type,
        isGroup: message.from.includes('@g.us')
    });
    
    const isGroup = message.from.includes('@g.us');
    
    if (isGroup) {

        const botMentioned = message.mentionedIds && message.mentionedIds.includes(global.botId);
        
        if (!botMentioned) {
            console.log('Mensaje de grupo sin mención al bot');
            return;
        }
        
        console.log('Bot mencionado en grupo, procesando mensaje');
    }
    
    const chat = await message.getChat();
    if (chat.archived || chat.isMuted) {
        console.log('Chat archivado o silenciado, omitido');
        return;
    }

    const senderId = message.from;
    
    if (message.body === '/cmds') {
        await showCommands(message);
    }
    else if (message.body === '/ai') {
        
        aiModeUsers[senderId] = true;
        await message.reply('Modo IA activado. Ahora puedes preguntarme lo que quieras. Para salir del modo IA, escribe "/exit".');
    }
    else if (message.body === '/exit' && aiModeUsers[senderId]) {
        
        aiModeUsers[senderId] = false;
        await message.reply('Has salido del modo IA. Para volver a activarlo, escribe "/ai".');
    }
    else if (aiModeUsers[senderId]) {
        
        // await message.reply('Procesando tu consulta...');
        const aiResponse = await processWithAI(message.body);
        await message.reply(aiResponse);
    }
    else if (containsGoodbye(message.body)) {
        await message.reply('¡Adiós! ¡Hasta la próxima!'); 
    }
    else if (containsHello(message.body)) {
        await message.reply('¡Hola! Soy un bot en desarrollo por JF. ¿En qué puedo ayudarte?' +
                'Puedes escribir "/cmds" para ver la lista de comandos disponibles.'
        );
    }
    else if (message.body.startsWith('/sticker')) {
        await createSticker(message);
    } else {
        await message.reply('Lo siento, no entiendo ese mensaje.\n Escribe "/cmds" para ver los comandos disponibles \nactiva el modo IA con "/ai".');
    }

    await sendWelcomeMessage(message);
});

client.initialize();
