from flask import Flask, jsonify, request, send_from_directory, send_file

import subprocess
from datetime import datetime
from pytz import utc
from database.CouchDB import *
import json
import os
import gzip
import geopandas as gpd
import pandas as pd
import plotly.graph_objects as go
import json
import datetime

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!</p> <br /> <p> This is a test of the Flask backend using nginx and gunicorn.'

def get_ip_and_container_id():
    ip = request.remote_addr
    container_id = os.uname().nodename
    return ip, container_id

# This route is used to test the connection to the backend
@app.route('/ping/')
def ping():
    try:

        ip, container_id = get_ip_and_container_id()
        access_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        response = f"Ping from {ip} on container {container_id} at {access_time}"
    except AttributeError:
        response = "The app is not running on docker container."
    return response

# This route is used to get the crime sentiment zipped json file
@app.route('/api/sudo/crime/', methods=['GET'])
def get_sudo_crime_data():
    graph_json_path = 'sudo/crime_vic_lga.json'
    full_path = os.path.join(app.root_path, graph_json_path)

    if os.path.exists(full_path):
        print(f"File '{graph_json_path}' already exists.")
    else:
        visualize_crime_data()

    compressed_file = 'sudo/crime_vic_lga.json.gz'
    compressed_file_path = os.path.join(app.root_path, compressed_file)

    if not os.path.exists(compressed_file_path):
        with open(full_path, 'rb') as f_in:
            with gzip.open(compressed_file_path, 'wb') as f_out:
                f_out.writelines(f_in)

    return send_file(compressed_file_path, as_attachment=True)    

# This route is used to get the income sentiment zipped json file
@app.route('/api/sudo/income/', methods=['GET'])
def get_sudo_income_data():
    graph_json_path = 'sudo/income_vic_sa2.json'
    full_path = os.path.join(app.root_path, graph_json_path)

    if os.path.exists(full_path):
        print(f"File '{graph_json_path}' already exists.")
    else:
        visualize_income_data()

    compressed_file = 'sudo/income_vic_sa2.json.gz'
    compressed_file_path = os.path.join(app.root_path, compressed_file)

    if not os.path.exists(compressed_file_path):
        with open(full_path, 'rb') as f_in:
            with gzip.open(compressed_file_path, 'wb') as f_out:
                f_out.writelines(f_in)

    return send_file(compressed_file_path, as_attachment=True)    

@app.route('/api/twitter/<forceupdate>', methods=['GET'])
def get_twitter_Image_data(forceupdate):
    """
    This Flask route generates or fetches previously generated data related to Twitter statistics, 
    and returns a compressed json file containing a choropleth map of tweet data.

    Args:
        forceupdate (str): If 'true', force the system to update the Twitter data views. Otherwise, use existing data if available.

    Returns:
        flask.Response: A compressed json file containing a choropleth map of Twitter data. In case of error, it returns a json message with status code.
    """
    # Create a CouchDB connection
    db = CouchDB('twitter_clean_geo_only')

    # View and file path definitions
    view_name = ['_design/sentimentLocation/_view/sentimentLocation',
                 '_design/incomeMentioned/_view/incomeMentioned',
                 '_design/sentimentCrime/_view/crimeMentioned']
    file_path = ['twitterData/sentimentLocation.json',
                 'twitterData/incomeMentioned.json',
                 'twitterData/crimeMentioned.json']
    
    # Reduce and group level for view fetching
    reduce = True
    group_level = 1

    # Handle 'forceupdate' parameter
    if forceupdate.lower() == 'true':
        forceupdate = True
    else:
        forceupdate = False

    # Process each CouchDB view
    for view, filename in zip(view_name, file_path):
        file_path = os.path.join(app.root_path, filename)

        # Skip existing files unless 'forceupdate' is True
        if not forceupdate and os.path.exists(file_path):
            print(f"File '{filename}' already exists. Skipping...")
            continue

        # Fetch and save view data
        try:
            result = db.db.view(view, reduce=reduce, group_level=group_level)
            view_data = [{"key": row.key, "value": row.value} for row in result]

            with open(file_path, 'w', buffering=8192) as file:
                json.dump(view_data, file)
        except couchdb.http.ResourceNotFound:
            # Handle view not found error
            return jsonify({"message": "Error: View not found.", "status": 404},404)
        except Exception as e:
            # Handle general exceptions
            return jsonify({"message": f"Error: {str(e)}", "status": 500},500)

    # Create choropleth map if it does not exist
    graph_json_path = 'twitterData/twitter_vic_sal.json'
    full_path = os.path.join(app.root_path, graph_json_path)

    if os.path.exists(full_path):
        if forceupdate:
            print(f"Creating choropleth map...")
            create_choropleth_map_twitter()
        else:
            print(f"File '{graph_json_path}' already exists.")
    else:
        print(f"Creating choropleth map...")
        create_choropleth_map_twitter()

    # Compress the choropleth map file
    compressed_file = 'twitterData/twitter_vic_sal.json.gz'
    compressed_file_path = os.path.join(app.root_path, compressed_file)


    if not os.path.exists(compressed_file_path) or forceupdate :
        print(f"Compressing choropleth map...")
        with open(full_path, 'rb') as f_in:
            with gzip.open(compressed_file_path, 'wb') as f_out:
                f_out.writelines(f_in)

    # Send the compressed file
    return send_file(compressed_file_path, as_attachment=True)


def create_choropleth_map_twitter():
    """
    This function creates a choropleth map of tweets categorized by sentiment, income, and crime, 
    focusing on the area of Victoria, Australia. The resulting plotly figure is saved as a JSON file.
    """
    def ready_for_join(df, name):
        """
        Prepare the dataframes for merging, setting keys and renaming columns as required.

        Args:
            df (pandas.DataFrame): DataFrame containing key and value columns
            name (str): Name of the dataset, used for column renaming.

        Returns:
            pandas.DataFrame: Transformed DataFrame ready for merging.
        """

        # Set the key for joining by taking the first element of the existing key
        df['key'] = df['key'].apply(lambda x: x[0])
        
        # Rename columns for clarity and to prevent clashes in the merged dataframe
        df.rename(columns={'key': 'SAL_CODE21'}, inplace=True)
        df.rename(columns={'value.count': 'count' + ' ' + name}, inplace=True)
        
        # Ensure the join key is of type string
        df = df.astype({'SAL_CODE21': str})
        
        # Calculate the average sentiment and round it to two decimal places
        df['average_sentiment' + '(' + name + ')'] = (df['value.sum'] / df['count' + ' ' + name]).round(2)

        return df


    # Load, normalize, and prepare each dataset
    for filename, topic in zip(['crimeMentioned.json', 'incomeMentioned.json', 'sentimentLocation.json'], ['crime', 'income', 'sentiment']):
        with open(f'twitterData/{filename}') as file:
            data = json.load(file)
        df = pd.json_normalize(data)
        df = ready_for_join(df, topic)
        if topic == 'crime':
            df_crime = df
        elif topic == 'income':
            df_income = df
        elif topic == 'sentiment':
            df_sentiment = df

    # Load and process shape file for Victoria
    sf_sal = gpd.read_file("SAL_2021_AUST_GDA94_SHP/SAL_2021_AUST_GDA94.shp")
    sf_sal['geometry'] = sf_sal['geometry'].to_crs("+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs")

    # Merge dataframes on 'SAL_CODE21'
    merged = pd.merge(sf_sal, df_crime[['count crime', 'average_sentiment(crime)', 'SAL_CODE21']], on='SAL_CODE21', how='left')
    merged = pd.merge(merged, df_income[['count income', 'average_sentiment(income)', 'SAL_CODE21']], on='SAL_CODE21', how='left')
    merged = pd.merge(merged, df_sentiment[['count sentiment', 'average_sentiment(sentiment)', 'SAL_CODE21']], on='SAL_CODE21', how='left')

    # Filter for rows pertaining to Victoria
    df_vic = merged[merged['STE_NAME21'] == 'Victoria']
    columns = ['count crime', 'count income', 'count sentiment', 'average_sentiment(crime)', 'average_sentiment(income)', 'average_sentiment(sentiment)']

    # Drop rows with all NaN values in the columns listed above
    df_vic = df_vic.dropna(how='all', subset=columns)

    # Set index for the dataframe
    df_vic.set_index('SAL_NAME21', inplace=True)

     # Initialize an empty figure
    fig = go.Figure()
    plot = ['count crime', 'count income', 'count sentiment', 'average_sentiment(crime)', 'average_sentiment(income)', 'average_sentiment(sentiment)']

    # Add a choropleth map trace for each topic
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
    # Create an interactive button for each topic
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
    # Update the layout of the figure
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
    # Save the figure as a JSON file
    fig.write_json('twitterData/twitter_vic_sal.json')



def visualize_crime_data():
    # Read the CSV file
    df_crime = pd.read_csv('sudo/crime.csv')

    # Drop rows with null values
    df_crime.fillna(0, inplace=True)

    # Drop duplicated rows
    df_crime.drop_duplicates(inplace=True)

    # Rename columns
    df_crime.rename(columns={' total_division_a_offences': 'against the person',
                             ' total_division_b_offences': 'property and deception',
                             ' total_division_c_offences': 'drug offences',
                             ' total_division_d_offences': 'public order and security',
                             ' total_division_e_offences': 'justice procedures',
                             ' total_division_f_offences': 'other offences'}, inplace=True)

    # Select the columns to plot
    columns_to_plot = ['against the person',
                       'property and deception',
                       'drug offences',
                       'public order and security',
                       'justice procedures',
                       'other offences']
    selected_df = df_crime[columns_to_plot]

    # Calculate the 5-number summary for 6 types of offences
    summary = df_crime[columns_to_plot].describe(percentiles=[0.0, 0.25, 0.5, 0.75, 1.0])
    summary = summary.round(2)

    # Drop outliers
    def drop_outliers(df, columns):
        for col in columns:
            q1 = summary[col]['25%']
            q3 = summary[col]['75%']
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            df = df.drop(df[(df[col] < lower_bound) | (df[col] > upper_bound)].index)
        return df

    df_crime = drop_outliers(df_crime, columns_to_plot)

    # Add a column of the total number of offences
    df_crime['total_all_offences'] = df_crime[columns_to_plot].sum(axis=1)

    # Calculate the 5-number summary for 6 types of offences and total offences
    columns_of_offences = columns_to_plot + ['total_all_offences']
    summary = df_crime[columns_of_offences].describe(percentiles=[0.0, 0.25, 0.5, 0.75, 1.0])
    summary = summary.round(2)

    # Read the shape file
    sf_lga = gpd.read_file("sudo/lga_2019_aust_shp/LGA_2019_AUST.shp")
    sf_lga['geometry'] = sf_lga['geometry'].to_crs("+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs")
    df_crime.rename(columns={' lga_code11': 'LGA_CODE19'}, inplace=True)
    sf_lga = sf_lga.astype({"LGA_CODE19": int})

    # Merge the crime dataframe with the shape file
    merged = sf_lga.merge(df_crime, on='LGA_CODE19')

    # Set the LGA_NAME19 column as the index
    merged.set_index(' lga_name11', inplace=True)

    # Create a choropleth map of the data with a selector
    fig = go.Figure()

    for col in columns_of_offences:
        fig.add_trace(go.Choroplethmapbox(
            geojson=merged.geometry.__geo_interface__,
            locations=merged.index,
            z=merged[col],
            colorscale=[[0, 'rgb(220, 230, 255)'],
                        [0.2, 'rgb(166, 206, 227)'],
                        [0.4, 'rgb(101, 156, 205)'],
                        [0.6, 'rgb(44, 123, 182)'],
                        [1, 'rgb(2, 56, 88)']],
            marker_opacity=0.7,
            zmin=merged[col].min(),
            zmax=merged[col].max(),
            name=col,
            visible=False
        ))

    fig.data[0].visible = True  # Set the first trace to be visible initially

    # Create a selector button to choose which trace to display
    buttons = []
    for i, col in enumerate(columns_of_offences):
        visible = [False] * len(columns_of_offences)
        visible[i] = True
        buttons.append(
            dict(
                label=col,
                method='update',
                args=[{'visible': visible}, {'title': f'{col} Distribution Across Melbourne LGAs'}]
            )
        )

    fig.update_layout(
        mapbox_style="carto-positron",
        mapbox_zoom=5,
        mapbox_center={"lat": -37.8136, "lon": 144.9631},
        updatemenus=[dict(
            type='buttons',
            showactive=True,
            buttons=buttons
        )],
        title=dict(text='Offences Distribution Across Melbourne LGAs')
    )

    fig.write_json('sudo/crime_vic_lga.json')

def visualize_income_data():
    # Read the CSV file into a Pandas DataFrame
    df_income = pd.read_csv('sudo/personal_income.csv')

    # Drop rows with null values
    df_income.dropna(inplace=True)

    # Drop duplicated rows
    df_income.drop_duplicates(inplace=True)

    # Rename columns
    df_income.rename(columns={' sa2_code': 'SA2_MAIN16'}, inplace=True)

    # Read the shape file
    sf_sa2 = gpd.read_file("sudo/sa2_2016_aust_shape/SA2_2016_AUST.shp")
    sf_sa2 = sf_sa2.astype({"SA2_MAIN16": int})
    merged = sf_sa2.merge(df_income, on='SA2_MAIN16')

    # Select the areas in Victoria only
    df_vic_income = merged[merged['STE_NAME16'] == 'Victoria']

    # Calculate the 5-number summary of the income
    summary = df_vic_income[['mean_aud', ' median_aud', ' sum_aud', ' median_age_of_earners_years']].describe(percentiles=[0.0, 0.25, 0.5, 0.75, 1.0]).round(2)

    # Plot the box plot for median age of earners
    selected_df1 = df_vic_income[[' median_age_of_earners_years']]
    
    # Drop outliers for mean, median, and sum of income
    columns = ['mean_aud', ' median_aud', ' sum_aud']
    def drop_outliers(df, columns):
        for col in columns:
            q1 = summary[col]['25%']
            q3 = summary[col]['75%']
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            df = df.drop(df[(df[col] < lower_bound) | (df[col] > upper_bound)].index)
        return df

    df_vic_income = drop_outliers(df_vic_income, columns)
    df_vic_income.drop_duplicates(inplace=True)

    # Create a choropleth map of the data with a selector
    df_vic_income.set_index('SA2_NAME16', inplace=True)
    fig = go.Figure()

    for col in ['mean_aud', ' median_aud', ' sum_aud', ' median_age_of_earners_years']:
        fig.add_trace(go.Choroplethmapbox(
            geojson=df_vic_income.geometry.__geo_interface__,
            locations=df_vic_income.index,
            z=df_vic_income[col],
            colorscale=[[0, 'rgb(220, 230, 255)'],
                        [0.2, 'rgb(166, 206, 227)'],
                        [0.4, 'rgb(101, 156, 205)'],
                        [0.6, 'rgb(44, 123, 182)'],
                        [1, 'rgb(2, 56, 88)']],
            marker_opacity=0.7,
            zmin=df_vic_income[col].min(),
            zmax=df_vic_income[col].max(),
            name=col,
            visible=False
        ))

    fig.data[0].visible = True  # Set the first trace to be visible initially

    # Create a selector button to choose which trace to display
    buttons = []
    for i, col in enumerate(['mean_aud', ' median_aud', ' sum_aud', ' median_age_of_earners_years']):
        visible = [False] * len(['mean_aud', ' median_aud', ' sum_aud', ' median_age_of_earners_years'])
        visible[i] = True
        buttons.append(
            dict(
                label=col,
                method='update',
                args=[{'visible': visible}, {'title': f'Personal {col} Distribution Across Australia SA2s'}]
            )
        )

    fig.update_layout(
        mapbox_style="carto-positron",
        mapbox_zoom=5,
        mapbox_center={"lat": -37.8136, "lon": 144.9631},
        updatemenus=[dict(
            type='buttons',
            showactive=True,
            buttons=buttons
        )],
        title=dict(text='Income Distribution Across Australia SA2s')
    )

    fig.write_json('sudo/income_vic_sa2.json')