const handler = require('serve-handler');
const http = require('http');

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: '.',
    cleanUrls: true
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Servidor corriendo en el puerto 3000 (todas las interfaces)');
});
