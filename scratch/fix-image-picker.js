const fs = require('fs'); 
const path = require('path'); 
const dir = 'mobile/src/screens'; 
fs.readdirSync(dir).forEach(file => { 
  if(file.endsWith('.jsx')) { 
    const fullPath = path.join(dir, file); 
    let content = fs.readFileSync(fullPath, 'utf8'); 
    if(content.includes('ImagePicker.MediaTypeOptions.Images')) { 
      content = content.replace(/ImagePicker\.MediaTypeOptions\.Images/g, "['images']"); 
      fs.writeFileSync(fullPath, content); 
      console.log('Updated ' + file); 
    } 
  } 
});
