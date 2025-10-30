// PATCH para adicionar funcionalidade de imagens ao widget.js
// Cole este código no lugar das funções correspondentes no widget.js

// 1. VARIÁVEL GLOBAL (adicionar no topo da função initWidget)
let selectedImage = null;

// 2. SUBSTITUIR a função sendMessage:
async function sendMessage(content) {
    // Verificar se tem conteúdo ou imagem
    if (!roomId || (!content.trim() && !selectedImage)) return;

    let imageUrl = null;
    let imageName = null;

    // Upload da imagem se houver
    if (selectedImage) {
        console.log('📤 ChatWidget: Uploading image...');
        try {
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileExt = selectedImage.name.split('.').pop();
            const fileName = `${timestamp}-${randomString}.${fileExt}`;
            const filePath = `chat/${fileName}`;

            const { data, error } = await supabaseClient.storage
                .from('chat-images')
                .upload(filePath, selectedImage, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('❌ Upload error:', error);
                alert('Erro ao enviar imagem. Tente novamente.');
                return;
            }

            const { data: { publicUrl } } = supabaseClient.storage
                .from('chat-images')
                .getPublicUrl(filePath);

            imageUrl = publicUrl;
            imageName = selectedImage.name;
            console.log('✅ Image uploaded:', publicUrl);
        } catch (error) {
            console.error('❌ Erro ao fazer upload:', error);
            alert('Erro ao enviar imagem. Tente novamente.');
            return;
        }
    }

    try {
        await supabaseClient.from('messages').insert({
            room_id: roomId,
            sender_type: 'visitor',
            sender_id: visitorId,
            sender_name: 'Visitante',
            content: content.trim() || null,
            image_url: imageUrl,
            image_name: imageName
        });

        const input = document.getElementById('chat-widget-input');
        if (input) input.value = '';

        // Limpar imagem selecionada
        if (selectedImage) {
            selectedImage = null;
            const preview = document.getElementById('chat-widget-image-preview');
            const fileInput = document.getElementById('chat-widget-file-input');
            if (preview) preview.style.display = 'none';
            if (fileInput) fileInput.value = '';
        }
    } catch (error) {
        console.error('ChatWidget: Error sending message', error);
    }
}

// 3. SUBSTITUIR a função addMessageToUI:
function addMessageToUI(message) {
    const messagesContainer = document.getElementById('chat-widget-messages');
    if (!messagesContainer) return;

    const isVisitor = message.sender_type === 'visitor';
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        ${isVisitor ? 'flex-direction: row-reverse;' : ''}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
        max-width: 70%;
        padding: 12px 16px;
        border-radius: 16px;
        ${isVisitor ? `
            background: ${widgetData.brand_color};
            color: white;
            border-top-right-radius: 4px;
        ` : `
            background: #f3f4f6;
            color: #1f2937;
            border-top-left-radius: 4px;
        `}
    `;

    // Adicionar texto se houver
    if (message.content) {
        const content = document.createElement('p');
        content.textContent = message.content;
        content.style.cssText = 'margin: 0; font-size: 14px; line-height: 1.5;';
        bubble.appendChild(content);
    }

    // Adicionar imagem se houver
    if (message.image_url) {
        const img = document.createElement('img');
        img.src = message.image_url;
        img.alt = message.image_name || 'Imagem';
        img.style.cssText = `
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
            margin-top: ${message.content ? '8px' : '0'};
            cursor: pointer;
            display: block;
        `;
        img.onclick = () => window.open(message.image_url, '_blank');
        img.title = 'Clique para abrir';
        bubble.appendChild(img);
    }

    const time = document.createElement('span');
    time.textContent = new Date(message.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    time.style.cssText = `
        display: block;
        margin-top: 4px;
        font-size: 11px;
        opacity: 0.7;
    `;

    bubble.appendChild(time);
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
}

// 4. ADICIONAR event listeners para imagem (adicionar após os event listeners existentes):
const imageBtn = document.getElementById('chat-widget-image-btn');
const fileInput = document.getElementById('chat-widget-file-input');
const removeImageBtn = document.getElementById('chat-widget-remove-image');

if (imageBtn) {
    imageBtn.addEventListener('click', () => {
        console.log('📷 Image button clicked');
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('📎 File selected:', file.name);

        // Validar tipo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WEBP.');
            return;
        }

        // Validar tamanho (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Arquivo muito grande. Tamanho máximo: 5MB');
            return;
        }

        // Mostrar preview
        selectedImage = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('chat-widget-preview-img').src = e.target.result;
            document.getElementById('chat-widget-image-preview').style.display = 'block';
            console.log('✅ Image preview displayed');
        };
        reader.readAsDataURL(file);
    });
}

if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
        console.log('❌ Removing image');
        selectedImage = null;
        document.getElementById('chat-widget-image-preview').style.display = 'none';
        fileInput.value = '';
    });
}

