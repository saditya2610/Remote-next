const g = require('@electron/get'); g.downloadArtifact({version:'32.3.3',artifactName:'electron'}).then(function(p){console.log('OK:'+p);}).catch(function(e){console.error(e.message);});  
