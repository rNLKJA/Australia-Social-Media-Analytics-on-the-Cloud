<h1 align=center>2023 S1 Cluster and Cloud Computing<br>Australia Social Media Analytics on the Cloud</h1>

The project focuses on an export of Twitter data
from the Australian Data Observatory [ADO](www.ado.eresearch.unimelb.edu.au) , data to be
harvested by students from the Mastodon APIs and data from the Spatial Urban Data Observatory
[SUDO](https://sudo.eresearch.unimelb.edu.au). The focus of this assignment is to use a large Twitter
corpus (that will be provided) to tell interesting stories of life in Australian and importantly how
social media data can be used alongside/compared with/augment the official data available within
the SUDO platform to improve our knowledge of life in Australia.

## Team 57

| Name              | Student ID | Email                                    |
| :---------------- | :--------: | :--------------------------------------- |
| Zongchao Xie      |  1174047   | zongchao.xie@student.unimelb.edu.au      |
| Xuan Wang         |  1329456   | xuan.wang19@student.unimelb.edu.au       |
| Runqiu Fei        |  1166093   | runqiu.fei@student.unimelb.edu.au        |
| Wei Zhao          |  1118649   | zhao.w2@student.unimelb.edu.au           |
| Sunchuangyu Huang |  1118472   | sunchuangy.huangh@student.unimelb.edu.au |

## Directories

```
team-57-ccc-assignment-2/
│
├── 1_FLASK_Backend/
│   ├── flask-backend/
│   │   ├── database
│   │   ├── mastodon
│   │   |    ├──── database.py
|   |   |    ├──── Harverstor.py
|   |   |    ├──── Harverstor.py
|   |   |    ├──── ...
│   │   ├── SAL_2021_AUST_GDA94_SHP ## SAL FILE folder
│   │   ├── sudo ## sudo file folder
│   │   ├── twitterData ## Twitter Data
│   │   ├── .env ## Environment
│   │   ├── app.py 
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   ├── wsgi.py ## WSGI

```



## Prerequisites
Before running this application, ensure that you have the following prerequisites installed:

Python (version 3.6 or higher)
pip (Python package installer)
[List any other prerequisites or dependencies specific to your project]


## Getting Started

To get started with this Flask project, follow these steps:

Clone the repository to your local machine:

Build the flask project using docker

```bash

pull redpeony159/myflaskapp:latest

docker run -p 8080:8080 redpeony159/myflaskapp

```

The application will be accessible at http://localhost:8080 by default.

## API Documentation
This documentation provides details about the API endpoints available in the Flask project.

### Get Crime Data
- Endpoint: /api/sudo/crime/
- Method: GET
  
This API endpoint retrieves crime data in a compressed JSON format. The endpoint checks if the data file already exists. If not, it generates the data by visualizing the crime data. The endpoint then compresses the data into a gzip format and returns it as an attachment.

### Get Income Data
- Endpoint: /api/sudo/income/
- Method: GET
This API endpoint retrieves income data in a compressed JSON format. Similar to the previous endpoint, it checks if the data file already exists. If not, it generates the data by visualizing the income data. The endpoint then compresses the data into a gzip format and returns it as an attachment.

### Get Twitter Image Data
- Endpoint: /api/twitter/<forceupdate>
- Method: GET
This API endpoint generates or retrieves previously generated data related to Twitter statistics. It returns a compressed JSON file containing a choropleth map of tweet data. The forceupdate parameter allows you to control whether to force an update of the Twitter data or use existing data if available.

### Parameters

- forceupdate (string): If set to "true", the system will force an update of the Twitter data views. Otherwise, it will use existing data if available.
Returns

The API endpoint returns a compressed JSON file containing a choropleth map of Twitter data. In case of an error, it returns a JSON message with an appropriate status code.

## License

The code will be public after 27th May 2023. For @copyright information please refer to MIT License.

---

<p alignright>Team 57</p>
