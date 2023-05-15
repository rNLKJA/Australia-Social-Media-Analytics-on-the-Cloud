from flask import Flask

from flask_apscheduler import APScheduler
from apscheduler.schedulers.background import BackgroundScheduler
import subprocess

app = Flask(__name__)

# initialize apscheduler
scheduler = APScheduler(BackgroundScheduler())

app.config["SCHEDULER_API_ENABLED"] = True

def run_Harvestor():
    output = subprocess.run(["python3", "mastodon/Harvestor.py"], capture_output=True)
    print(output.stdout.decode())  # Print the stdout from the Harvestor script

scheduler.add_job(id="Harvestor", func=run_Harvestor, trigger="interval", seconds=60)

scheduler.start()

@app.route('/')
def hello_world():
    return 'Hello, World!</p> <br /> <p> This is a test of the Flask backend using nginx and gunicorn.'

@app.route('/mastodon/<string:mastodon_server>', methods=['GET'])
def mastodon_scraper(mastodon_server):
    return f"Hello, {mastodon_server}!"
