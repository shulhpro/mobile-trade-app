п»їconst fs=require('fs');
let c=fs.readFileSync('C:/bitrix/server.js','utf8');
const idx=c.indexOf('app.listen(PORT');
if(idx>=0){
  const before=c.substring(0,idx);
  const after=c.substring(idx);
  const route='// Root route - serve index.html\napp.get("/", (req, res) => {\n  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");\n  res.setHeader("Pragma", "no-cache");\n  res.setHeader("Expires", "0");\n  res.sendFile(path.join(__dirname, "public", "index.html"));\n});\n\n';
  c=before+route+after;
  fs.writeFileSync('C:/bitrix/server.js',c,'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND');
}
