document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const establishmentsTextarea = document.getElementById('establishments');
  const progressBar = document.getElementById('progress');
  const statusElement = document.getElementById('status');
  
  let allData = [];
  let isProcessing = false;
  
  // Cargar datos guardados (si existen)
  chrome.storage.local.get(['establishmentsData', 'collectedData'], function(result) {
    if (result.establishmentsData) {
      establishmentsTextarea.value = result.establishmentsData;
    }
    
    if (result.collectedData && result.collectedData.length > 0) {
      allData = result.collectedData;
      downloadBtn.disabled = false;
    }
  });
  
  // Evento para iniciar el proceso
  startBtn.addEventListener('click', function() {
    if (isProcessing) {
      return;
    }
    
    const establishments = establishmentsTextarea.value.trim();
    
    if (!establishments) {
      statusElement.textContent = 'Error: Ingresa al menos un establecimiento';
      return;
    }
    
    // Guardar los datos del textarea
    chrome.storage.local.set({
      establishmentsData: establishments
    });
    
    // Obtener lista de establecimientos
    const establishmentsList = establishments.split('\n').filter(line => line.trim() !== '');
    
    if (establishmentsList.length === 0) {
      statusElement.textContent = 'Error: Ingresa al menos un establecimiento válido';
      return;
    }
    
    // Inicializar datos
    allData = [];
    isProcessing = true;
    startBtn.disabled = true;
    downloadBtn.disabled = true;
    
    // Resetear progreso
    let completedCount = 0;
    progressBar.style.width = '0%';
    
    // Enviar mensaje al background script para iniciar el proceso
    chrome.runtime.sendMessage({
      action: 'startProcess',
      establishments: establishmentsList
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error("Error al comunicarse con el background script:", chrome.runtime.lastError);
        statusElement.textContent = 'Error: No se pudo iniciar el proceso';
        startBtn.disabled = false;
        isProcessing = false;
        return;
      }
      
      if (response && response.status === 'started') {
        statusElement.textContent = `Iniciando proceso para ${establishmentsList.length} establecimientos...`;
      }
    });
    
    // Escuchar actualizaciones de progreso
    chrome.runtime.onMessage.addListener(function listener(message) {
      if (message.action === 'progressUpdate') {
        completedCount = message.completed;
        const percentage = Math.round((completedCount / establishmentsList.length) * 100);
        progressBar.style.width = percentage + '%';
        statusElement.textContent = `Procesando ${completedCount}/${establishmentsList.length} (${percentage}%)`;
      } 
      else if (message.action === 'dataCollected') {
        allData.push(message.data);
        // Guardar datos en storage
        chrome.storage.local.set({
          collectedData: allData
        });
      }
      else if (message.action === 'processComplete') {
        statusElement.textContent = 'Proceso completado. Puedes descargar los datos.';
        progressBar.style.width = '100%';
        startBtn.disabled = false;
        downloadBtn.disabled = false;
        isProcessing = false;
        
        // Remover el listener
        chrome.runtime.onMessage.removeListener(listener);
      }
      else if (message.action === 'processError') {
        statusElement.textContent = `Error: ${message.error}`;
        startBtn.disabled = false;
        isProcessing = false;
        
        // Remover el listener
        chrome.runtime.onMessage.removeListener(listener);
      }
    });
  });
  
  // Evento para descargar el CSV
  downloadBtn.addEventListener('click', function() {
    if (allData.length === 0) {
      statusElement.textContent = 'No hay datos para descargar';
      return;
    }
    
    // Convertir datos a CSV
    let csvContent = 'Consulta Original,Nombre,Dirección,Teléfono,Correo Electrónico\n';
    
    allData.forEach(item => {
      const query = item.query ? `"${item.query.replace(/"/g, '""')}"` : '';
      const name = item.name ? `"${item.name.replace(/"/g, '""')}"` : '';
      const address = item.address ? `"${item.address.replace(/"/g, '""')}"` : '';
      const phone = item.phone ? `"${item.phone.replace(/"/g, '""')}"` : '';
      const email = item.email ? `"${item.email.replace(/"/g, '""')}"` : '';
      
      csvContent += `${query},${name},${address},${phone},${email}\n`;
    });
    
    // Crear un blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    
    chrome.downloads.download({
      url: url,
      filename: `establecimientos_${date}.csv`,
      saveAs: true
    });
    
    statusElement.textContent = 'Descargando CSV...';
  });
});