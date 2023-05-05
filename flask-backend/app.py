from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!</p> <br /> <p> This is a test of the Flask backend using nginx and gunicorn.'