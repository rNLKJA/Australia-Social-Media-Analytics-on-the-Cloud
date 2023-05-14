from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!</p> <br /> <p> This is a test of the Flask backend using nginx and gunicorn.'

@app.route('/mastodon/<string:mastodon_server>', method=['GET'])
def mastodon_scarper(mastodon_server):
    return f"Hello, {mastodon_server}!"