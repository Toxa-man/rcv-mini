import http.server
import ssl

httpd = http.server.HTTPServer(('0.0.0.0', 4443), http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket (httpd.socket, keyfile='./cert/key.pem', certfile='./cert/cert.pem', server_side=True)
httpd.serve_forever()