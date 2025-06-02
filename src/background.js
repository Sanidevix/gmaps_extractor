// Variables globales
let establishmentsList = [];
let currentIndex = 0;
let tabId = null;
let processingComplete = false;
let processingCancelled = false;
let closeTabs = true;
const NUM_RETRIES = 60;
let retryCount = 0;

// Manejar mensajes
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'startProcess') {
    console.log("LOG START: startProcess");
	
	establishmentsList = message.establishments;
    currentIndex = 0;
    processingComplete = false;
    processingCancelled = false;
	
    // Confirmar recepción
    sendResponse({ status: 'started' });
    
	// Iniciar procesamiento del primer establecimiento
    processNext();
    
	console.log("LOG END: startProcess");
    return true; // Indicar respuesta asíncrona
  }
  else if (message.action === 'dataExtracted') {
	  console.log("LOG START: dataExtracted");
    // Datos recibidos desde content script
    const dataList = message.data;
    
    // Enviar cada resultado individualmente al popup
    if (Array.isArray(dataList)) {
      dataList.forEach(data => {
        chrome.runtime.sendMessage({
          action: 'dataCollected',
          data: data
        });
      });
    } else {
      // Por compatibilidad, si no es un array, enviarlo como un solo elemento
      chrome.runtime.sendMessage({
        action: 'dataCollected',
        data: dataList
      });
    }
    
    // Cerrar la pestaña actual
	if(closeTabs) {
		if (tabId !== null) {
		  chrome.tabs.remove(tabId, function() {
			if (chrome.runtime.lastError) {
			  console.error("Error al cerrar la pestaña:",chrome.runtime.lastError.message, JSON.stringify(chrome.runtime.lastError));
			}
			
			// Esperar un poco antes de continuar con el siguiente
			setTimeout(function() {
			  tabId = null;
			  retryCount = 0;
			  processNext();
			}, 1000);
		  });
		} else {
		  processNext();
		}
	}
	
	 console.log("LOG END: dataExtracted");
	
	return true; // Indicar respuesta asíncrona
  }
  else if (message.action === 'extractionError') {
    console.error("Error de extracción:", message.error);
    
    // Cerrar la pestaña actual y continuar con el siguiente
	if(closeTabs) {
		if (tabId !== null) {
		  chrome.tabs.remove(tabId, function() {
			if (chrome.runtime.lastError) {
			  console.error("Error al cerrar la pestaña:",chrome.runtime.lastError.message, JSON.stringify(chrome.runtime.lastError));
			}
			
			setTimeout(function() {
			  tabId = null;
			  retryCount = 0;
			  processNext();
			}, 1000);
		  });
		} else {
		  processNext();
		}
    }
	
    return true; // Indicar respuesta asíncrona
  }
});

// Procesar el siguiente establecimiento
function processNext() {
	console.log("LOG START: processNext");
  // Verificar si se ha completado o cancelado el procesamiento
  if (processingCancelled || currentIndex >= establishmentsList.length) {
    if (!processingComplete) {
      processingComplete = true;
      
      // Notificar finalización
      chrome.runtime.sendMessage({
        action: 'processComplete'
      });
    }
    return;
  }
  
  // Actualizar progreso
  chrome.runtime.sendMessage({
    action: 'progressUpdate',
    completed: currentIndex,
    total: establishmentsList.length
  });
  
  const establishment = establishmentsList[currentIndex];
  currentIndex++;
  
  // Crear nueva pestaña para la búsqueda
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(establishment)}`;
  
  chrome.tabs.create({ url: searchUrl, active: false }, function(tab) {
    if (chrome.runtime.lastError) {
      console.error("Error al crear pestaña:",chrome.runtime.lastError.message, JSON.stringify(chrome.runtime.lastError));
      chrome.runtime.sendMessage({
        action: 'processError',
        error: 'No se pudo crear una nueva pestaña'
      });
      processingCancelled = true;
      return;
    }
    
    tabId = tab.id;
	console.log("TabID: "+tabId+" - " + establishment);
    
    // Esperar a que la página cargue completamente
    retryCount = 0;
    
	setTimeout(() => {
	  console.log("Esperando inicialización por 1 segundo...");
	}, 1000);
		
    function checkAndInjectScript() {
      if (tabId && retryCount > NUM_RETRIES) { // Máximo 10 segundos de espera (20 * 500ms)
        console.error("Tiempo de espera agotado para la pestaña:", tabId);
        // Continuar con el siguiente establecimiento
		if(closeTabs) {
			chrome.tabs.remove(tabId, function() {
			  if (chrome.runtime.lastError) {
				console.error("Error al cerrar la pestaña:",chrome.runtime.lastError.message, JSON.stringify(chrome.runtime.lastError));
			  }
			  
			  setTimeout(function() {
				tabId = null;
				retryCount = 0;
				processNext();
			  }, 1000);
			});
		}
		
        return;
      }
      
      // Intentar ejecutar content script
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Verificar si ya se inicializó el script
          return !!window.mapsDataCollectorInitialized;
        }
      }).then((results) => {
        const isAlreadyInitialized = results && results[0] && results[0].result;
        
        if (isAlreadyInitialized) {
          // Script ya inicializado, enviar mensaje directamente
          chrome.tabs.sendMessage(tab.id, {
            action: 'extractData',
            query: establishment
          }).catch(err => {
            retryCount++;
			console.log("Reinjectando en TabID: " + tabId + " con intento " + retryCount);
			if(tabId !== null && retryCount < NUM_RETRIES ) {
				setTimeout(checkAndInjectScript, 1000);
			}
          });
        } else {
          // Inyectar script por primera vez
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            // Dar tiempo para que se inicialice el content script
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'extractData',
                query: establishment
              }).catch(err => {
                retryCount++;
				console.log("Reinjectando en TabID: " + tabId + " con intento " + retryCount);
                if(tabId !== null && retryCount < NUM_RETRIES ) {
					setTimeout(checkAndInjectScript, 1000);
				}
              });
            }, 1000);
          });
        }
      }).catch(error => {
        // Error al inyectar script, posiblemente la página aún no está lista
        retryCount++;
		console.log("Reinjectando en TabID: " + tabId + " con intento " + retryCount);
        if(tabId !== null && retryCount < NUM_RETRIES ) {
				setTimeout(checkAndInjectScript, 1000);
			}
      });
    }
    
    // Esperar un poco antes de intentar inyectar el script
    if(tabId !== null && retryCount < NUM_RETRIES ) {
				setTimeout(checkAndInjectScript, 2000);
			}
  });
}

// Manejar errores de conexión en mensajes
chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
  // Ignorar mensajes externos
  return false;
});