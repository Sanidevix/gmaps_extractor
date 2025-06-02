// Inicializar el content script solo si no se ha hecho antes
function initialize() {
  // Usamos una variable global en window para evitar duplicados
  if (window.mapsDataCollectorInitialized) return;
  window.mapsDataCollectorInitialized = true;
  
  // Escuchar mensajes del background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'extractData') {
      extractAllData(message.query)
        .then(dataList => {
          chrome.runtime.sendMessage({
            action: 'dataExtracted',
            data: dataList
          });
        })
        .catch(error => {
          console.error("Error al extraer datos:", error);
          chrome.runtime.sendMessage({
            action: 'extractionError',
            error: error.message || 'Error desconocido'
          });
        });
      
      return true; // Indicar respuesta asíncrona
    }
  });
}

// Extraer datos de todos los resultados o del detalle
async function extractAllData(query) {
  console.log("Extrayendo datos para la consulta:", query);
  // Esperar a que los resultados se carguen
  await waitForResults();
  
  // Verificar si estamos en una página de detalle o de resultados
  if (isDetailPage()) {
    // Estamos en una página de detalle (un solo resultado)
    console.log("Página de detalle detectada");
    const data = await extractDataFromDetail(query);
    return [data]; // Devolver como lista con un elemento
  } else {
    // Estamos en una página de resultados (múltiples)
    console.log("Página de resultados detectada");
    return await extractDataFromResultsList(query);
  }
}

// Extraer datos de la página de resultados (múltiples)
async function extractDataFromResultsList(query) {
  const results = [];
  
  // Esperar a que el feed de resultados aparezca
  const resultElements = await waitForElements('[role="feed"] > div, .section-result, .section-result-content, [jsaction*="placeCard"], div[jsaction] > a[href*="maps/place"]');
  console.log(`Encontrados ${resultElements.length} resultados potenciales`);
  
  if (resultElements.length === 0) {
    // Si no hay resultados, devolver un registro vacío
    return [{
      query: query,
      name: 'No se encontraron resultados',
      address: '',
      phone: '',
      email: ''
    }];
  }
  
  // Limitar a los primeros 5 resultados para evitar problemas
  const maxResults = Math.min(resultElements.length, 5);
  
  for (let i = 0; i < maxResults; i++) {
    try {
      console.log(`Procesando resultado ${i+1} de ${maxResults}`);
      const element = resultElements[i];
      
      // Extraer el nombre directamente del elemento de resultado
      let name = '';
      const nameElement = element.querySelector('h3, h2, h1, div[role="heading"], .section-result-title');
      if (nameElement) {
        name = nameElement.textContent.trim();
      }
      
      // Extraer la dirección si está disponible en la vista de resultados
      let address = '';
      const addressElements = element.querySelectorAll('span, div');
      for (const el of addressElements) {
        const text = el.textContent.trim();
        if (text.match(/^[A-Za-z0-9\s\.,#-]+$/)) {
          if (text.length > 5 && !text.includes('⋅') && !text.includes('·')) {
            address = text;
            break;
          }
        }
      }
      
      // Crear un objeto de datos básico con lo que tenemos
      const basicData = {
        query: query,
        name: name || 'Nombre no encontrado',
        address: address || '',
        phone: '',
        email: ''
      };
      
      results.push(basicData);
      
      // Nota: Para datos completos tendríamos que hacer clic en cada resultado
      // Pero eso complicaría mucho la lógica y podría causar problemas de rendimiento
    } catch (error) {
      console.error(`Error al procesar resultado ${i+1}:`, error);
    }
  }
  
  // Si tenemos al menos un resultado, hacer clic en el primero para obtener datos detallados
  if (results.length > 0 && resultElements.length > 0) {
    try {
      console.log("Haciendo clic en el primer resultado para obtener datos detallados");
      resultElements[0].click();
      
      // Esperar a que se cargue la página de detalle
      await waitForDetailPage();
      
      // Extraer datos detallados para el primer resultado
      const detailedData = await extractDataFromDetail(query);
      
      // Actualizar el primer resultado con los datos detallados
      results[0] = detailedData;
    } catch (error) {
      console.error("Error al hacer clic en el primer resultado:", error);
    }
  }
  
  return results;
}

// Extraer datos de una página de detalle (un solo resultado)
async function extractDataFromDetail(query) {
  console.log("Extrayendo datos de la página de detalle");
  // Esperar a que los elementos clave estén disponibles
  await waitForElements('h1, [role="heading"], button[data-item-id="address"], button[data-item-id="phone"]', 8000);
  
  // Crear estructura de datos
  const data = {
    query: query,
    name: '',
    address: '',
    phone: '',
    email: ''
  };
  
  try {
    // Extraer el nombre (h1 o encabezado principal)
    const nameElements = document.querySelectorAll('h1, [role="heading"]');
    if (nameElements.length > 0) {
      data.name = nameElements[0].textContent.trim();
      console.log("Nombre encontrado:", data.name);
    }
    
    // Extraer la dirección
    const addressButton = findElementByContent('button, div[role="button"]', 
      ['dirección', 'address', 'ubicación', 'location'], 
      [/calle/i, /avenida/i, /av\./i, /plaza/i, /colonia/i, /blvd/i, /boulevard/i, /\d+\s+\w+/]
    );
    
    if (addressButton) {
      data.address = cleanText(addressButton.textContent);
      console.log("Dirección encontrada:", data.address);
    }
    
    // Extraer teléfono
    const phoneButton = findElementByContent('button, div[role="button"]', 
      ['teléfono', 'phone', 'llamar', 'call'], 
      [/\+?\d[\d\s\-\(\)]{6,}/]
    );
    
    if (phoneButton) {
      data.phone = extractPhone(phoneButton.textContent);
      console.log("Teléfono encontrado:", data.phone);
    }
	
	// Forzado del telefonos
	console.log("Forzado: " + encontrarBotonesConTelefono());
	data.phone = encontrarBotonesConTelefono();
    
    // Buscar correo electrónico (más difícil, puede estar en varias ubicaciones)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // 1. Buscar en información de contacto
    const contactElements = document.querySelectorAll('a[href^="mailto:"], button, div[role="button"], span');
    
    for (const el of contactElements) {
      // Verificar si es un enlace mailto
      if (el.tagName === 'A' && el.href && el.href.toLowerCase().startsWith('mailto:')) {
        data.email = el.href.replace(/^mailto:/i, '').split('?')[0];
        console.log("Email encontrado en enlace mailto:", data.email);
        break;
      }
      
      // Buscar correo en el texto
      const text = el.textContent;
      const match = text.match(emailRegex);
      
      if (match) {
        data.email = match[0];
        console.log("Email encontrado en texto:", data.email);
        break;
      }
    }
    
    // 2. Si no se encontró email, buscar en el sitio web
    if (!data.email) {
      const websiteButton = findElementByContent('button, div[role="button"], a', 
        ['sitio web', 'website', 'página web', 'web', 'página oficial', 'official site'], 
        [/www\./i, /\.com/i, /\.net/i, /\.org/i]
      );
      
      if (websiteButton) {
        console.log("Sitio web encontrado, pero no podemos navegar a él directamente para extraer el email");
      }
    }
    
    // Asegurarse de que ningún campo sea undefined o null
    for (const key in data) {
      if (data[key] === undefined || data[key] === null) {
        data[key] = '';
      }
    }
    
    return data;
  } catch (error) {
    console.error("Error al extraer datos de detalle:", error);
    // Asegurarse de devolver al menos la consulta original
    return {
      query: query,
      name: data.name || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || ''
    };
  }
}

// Encontrar elemento por contenido textual
function findElementByContent(selector, keywords, patterns) {
  const elements = document.querySelectorAll(selector);
  
  for (const el of elements) {
    const text = el.textContent.toLowerCase();
    
    // Verificar palabras clave
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return el;
      }
    }
    
    // Verificar patrones
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return el;
      }
    }
  }
  
  return null;
}

// Funciones auxiliares
function cleanText(text) {
  return text
    .replace(/^(dirección|address|teléfono|phone|email|correo electrónico)\s*[:\-]?\s*/i, '')
    .replace(/^(cómo llegar|get directions|indicaciones)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhone(text) {
  // Extraer número telefónico
  const phoneRegex = /\+?[\d\s\-\(\)]{7,}/g;
  const match = text.match(phoneRegex);
  
  if (match) {
    return match[0].trim();
  }
  
  return cleanText(text);
}

function isDetailPage() {
  // Verificar si estamos en una página de detalle
  return !!document.querySelector('h1, [role="heading"]') &&
         (window.location.href.includes('/place/') || 
          window.location.href.includes('/maps/place/'));
}

async function waitForDetailPage() {
  console.log("Esperando a que cargue la página de detalle...");
  return new Promise(resolve => {
    let checkCount = 0;
    const maxChecks = 30;
    
    const checkDetail = () => {
      if (isDetailPage() || checkCount >= maxChecks) {
        // Esperar un poco más para que los datos terminen de cargar
        setTimeout(resolve, 1000);
        return;
      }
      
      checkCount++;
      setTimeout(checkDetail, 500);
    };
    
    checkDetail();
  });
}

async function waitForResults() {
  console.log("Esperando a que carguen los resultados...");
  return new Promise(resolve => {
    let checkCount = 0;
    const maxChecks = 20;
    
    const checkResults = () => {
      const hasResults = document.querySelector('[role="feed"], .section-result-content, h1, [role="heading"]');
      
      if (hasResults || checkCount >= maxChecks) {
        // Esperar un poco más para que los datos terminen de cargar
        setTimeout(resolve, 1000);
        return;
      }
      
      checkCount++;
      setTimeout(checkResults, 500);
    };
    
    checkResults();
  });
}

async function waitForElements(selector, timeout = 10000) {
  console.log(`Esperando elementos: ${selector}`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Encontrados ${elements.length} elementos`);
      return Array.from(elements);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`Tiempo agotado esperando: ${selector}`);
  return [];
}

function encontrarBotonesConTelefono() {
  // Expresión regular para buscar patrones de números de teléfono
  //const regexTelefono = /(\+\d{1,3}\s?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;
  const regexTelefono = /\+[\d\s\-\(\)]{7,}/g;

  // Seleccionar todos los elementos de tipo button
  const botones = document.querySelectorAll('button');
  console.log("Total de botones encontrados:", botones.length);

  const botonesConTelefono = [];
  const telefonos = [];

  botones.forEach(boton => {
    // Comprobar si el texto contenido dentro del botón coincide con la expresión regular
    if (boton.textContent && regexTelefono.test(boton.textContent)) {
      botonesConTelefono.push(boton);
    }
  });

  if (botonesConTelefono.length > 0) {
    console.log("Se encontraron números de teléfono en los siguientes botones:");
    botonesConTelefono.forEach(boton => {
      console.log("  Texto encontrado:", boton.textContent.match(regexTelefono));
	  telefonos.push(boton.textContent.match(regexTelefono));
    });
  } else {
    console.log("No se encontraron números de teléfono en el texto de ningún botón.");
  }

	//Devolvemos un string
  return telefonos.join(',');
}

// Inicializar cuando se carga el script
initialize();