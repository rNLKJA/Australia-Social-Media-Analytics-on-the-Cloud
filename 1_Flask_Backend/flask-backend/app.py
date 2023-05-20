from flask import Flask, jsonify, request, send_from_directory, send_file

from flask_apscheduler import APScheduler
from apscheduler.schedulers.background import BackgroundScheduler
import subprocess
from datetime import datetime
from pytz import utc
from database.CouchDB import *
import json
import os
import gzip
import shutil



app = Flask(__name__)

# initialize apscheduler
scheduler = APScheduler(BackgroundScheduler())

app.config["SCHEDULER_API_ENABLED"] = True

def run_mastodon_harvester():
    subprocess.Popen(["python", "mastodon/Haverstor.py"])

    

# scheduler.add_job(id="Harvestor", func=run_mastodon_harvester, next_run_time=datetime.now(utc))

# scheduler.start()

@app.route('/')
def hello_world():
    return 'Hello, World!</p> <br /> <p> This is a test of the Flask backend using nginx and gunicorn.'

@app.route('/mastodon/<string:mastodon_server>', methods=['GET'])
def mastodon_scraper(mastodon_server):
    return f"Hello, {mastodon_server}!"


@app.route('/try', methods=['GET'])
def try_couchdb():
    db = CouchDB('twitter_clean_geo_only')
    result = db.list_documents()
    print(result)

    return jsonify(result)

@app.route('/api/twitter/<forceupdate>', methods=['GET'])
def get_twitter_Image_data(forceupdate):
    db = CouchDB('twitter_clean_geo_only')

    view_name = ['_design/sentimentLocation/_view/sentimentLocation',
                 '_design/incomeMentioned/_view/incomeMentioned',
                 '_design/sentimentCrime/_view/crimeMentioned']
    file_path = ['twitterData/sentimentLocation.json',
                 'twitterData/incomeMentioned.json',
                 'twitterData/crimeMentioned.json']
    reduce = True
    group_level = 1

    try:
        if forceupdate.lower() == 'true':
            forceupdate = True
        else:
            forceupdate = False

        for view, filename in zip(view_name, file_path):
            file_path = os.path.join(app.root_path, filename)

            if not forceupdate:
                if os.path.exists(file_path):
                    print(f"File '{filename}' already exists. Skipping...")
                    continue

            result = db.db.view(view, reduce=reduce, group_level=group_level)
            view_data = [{"key": row.key, "value": row.value} for row in result]

            with open(file_path, 'w', buffering=8192) as file:
                json.dump(view_data, file)

    except couchdb.http.ResourceNotFound:
        return jsonify({"message": "Error: View not found.", "status": 404})

    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}", "status": 500})

    
    graph_json_path = 'twitterData/twitter_vic_sal.json'
    full_path = os.path.join(app.root_path, graph_json_path)

    if os.path.exists(full_path):
        print(f"File '{graph_json_path}' already exists.")
    else:
        create_choropleth_map_twitter()

    compressed_file = 'twitterData/twitter_vic_sal.json.gz'
    compressed_file_path = os.path.join(app.root_path, compressed_file)

    if not os.path.exists(compressed_file_path):
        with open(full_path, 'rb') as f_in:
            with gzip.open(compressed_file_path, 'wb') as f_out:
                f_out.writelines(f_in)

    return send_file(compressed_file_path, as_attachment=True)


import geopandas as gpd
import pandas as pd
import plotly.graph_objects as go
import json

def create_choropleth_map_twitter():
    def ready_for_join(df, name):
        df['key'] = df['key'].apply(lambda x: x[0])
        df.rename(columns={'key': 'SAL_CODE21'}, inplace=True)
        df.rename(columns={'value.count': 'count' + ' ' + name}, inplace=True)
        df = df.astype({'SAL_CODE21': str})
        df['average_sentiment' + '(' + name + ')'] = (df['value.sum'] / df['count' + ' ' + name]).round(2)
        return df

    with open('twitterData/crimeMentioned.json') as file:
        data = json.load(file)
    rows_data = data
    df_crime = pd.json_normalize(rows_data)
    df_crime = ready_for_join(df_crime, 'crime')

    with open('twitterData/incomeMentioned.json') as file:
        data = json.load(file)
    rows_data = data
    df_income = pd.json_normalize(rows_data)
    df_income = ready_for_join(df_income, 'income')

    with open('twitterData/sentimentLocation.json') as file:
        data = json.load(file)
    rows_data = data
    df_sentiment = pd.json_normalize(rows_data)
    df_sentiment = ready_for_join(df_sentiment, 'sentiment')

    sf_sal = gpd.read_file("SAL_2021_AUST_GDA94_SHP/SAL_2021_AUST_GDA94.shp")
    sf_sal['geometry'] = sf_sal['geometry'].to_crs("+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs")

    merged = pd.merge(sf_sal, df_crime[['count crime', 'average_sentiment(crime)', 'SAL_CODE21']], on='SAL_CODE21', how='left')
    merged = pd.merge(merged, df_income[['count income', 'average_sentiment(income)', 'SAL_CODE21']], on='SAL_CODE21', how='left')
    merged = pd.merge(merged, df_sentiment[['count sentiment', 'average_sentiment(sentiment)', 'SAL_CODE21']], on='SAL_CODE21', how='left')

    df_vic = merged[merged['STE_NAME21'] == 'Victoria']
    columns = ['count crime', 'count income', 'count sentiment', 'average_sentiment(crime)', 'average_sentiment(income)', 'average_sentiment(sentiment)']
    df_vic = df_vic.dropna(how='all', subset=columns)
    df_vic.set_index('SAL_NAME21', inplace=True)

    fig = go.Figure()
    plot = ['count crime', 'count income', 'count sentiment', 'average_sentiment(crime)', 'average_sentiment(income)', 'average_sentiment(sentiment)']

    for col in plot:
        fig.add_trace(go.Choroplethmapbox(
            geojson=df_vic.geometry.__geo_interface__,
            locations=df_vic.index,
            z=df_vic[col],
            colorscale=[[0, 'rgb(220, 230, 255)'],
                        [0.2, 'rgb(166, 206, 227)'],
                        [0.4, 'rgb(101, 156, 205)'],
                        [0.6, 'rgb(44, 123, 182)'],
                        [1, 'rgb(2, 56, 88)']],
            marker_opacity=0.7,
            zmin=df_vic[col].min(),
            zmax=df_vic[col].max(),
            name=col,
            visible=False
        ))

    fig.data[0].visible = True

    buttons = []
    for i, col in enumerate(plot):
        visible = [False] * len(plot)
        visible[i] = True
        buttons.append(
            dict(
                label=col,
                method='update',
                args=[{'visible': visible}, {'title': f'{col} Distribution Across Australia'}]
            )
        )

    fig.update_layout(
        mapbox_style="carto-positron",
        mapbox_zoom=9,
        mapbox_center={"lat": -37.8136, "lon": 144.9631},
        updatemenus=[dict(
            type='buttons',
            showactive=True,
            buttons=buttons
        )],
        title=dict(text='Twitter Content Distribution Across Melbourne SALs')
    )

    fig.write_json('twitterData/twitter_vic_sal.json')






