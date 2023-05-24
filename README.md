<h1 align=center>2023 S1 Cluster and Cloud Computing<br>Australia Social Media Analytics on the Cloud<br>Social Sence Dashboard</h1>

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
| Zongchao Xie      | 1174047    | zongchao.xie@student.unimelb.edu.au      |
| Xuan Wang         | 1329456    | xuan.wang19@student.unimelb.edu.au       |
| Runqiu Fei        | 1166093    | runqiu.fei@student.unimelb.edu.au        |
| Wei Zhao          | 1118649    | zhao.w2@student.unimelb.edu.au           |
| Sunchuangyu Huang | 1118472    | sunchuangy.huangh@student.unimelb.edu.au |


## Directories

From listing folder, there are five parts of our project. Therefore:
1. For Backend Application, access 1_Flask_Backend
2. For Frontend Application, access 2_ReactJS_frontend
3. For CouchDB deployment, access 3_CouchDB_database
4. For Data Processing and Data Scraping, access 4_Python_data_processing
5. For Ansible IT Automation, access 5_Ansible_IT_Automation

See README in each folder for detailed implementations.

## Dependencies

- Backend: Python3>=3.9, Flask
- Frontend: Javascript, Node.js>=12, React.js
- Database: CouchDB v3.2.1
- Data Scraping: jupyterlab>=3.0.0, Python, MPI
- IT Automation: Ansible, YAML 

## Instance Access

- Frontend: http://172.26.130.83:3000
- Backend: http://172.26.128.118:8080
- Database: 
    - CouchDB Fauxton: http://172.26.134.180:5984/_utils/
    - CouchDB Photon: http://172.26.134.180:5984/photon/_design/photon/index.html#  
    
    For database access, username and password are required where username == password == group58 (although we are group 57).

## Documentation

- Overleaf Project Report: https://www.overleaf.com/read/fvkvxvsrtsxs
- Canva Presentation Slide: https://www.canva.com/design/DAFjo4avJwE/wclPChIlSh_BJLDBhiELpw/edit?utm_content=DAFjo4avJwE&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
- Google Drive: https://drive.google.com/drive/folders/1FOknAUgjB2_vY_RMuA7rcAw_w2nRCNmJ?usp=sharing

## Data Sources

- Spatial Urban Data Observatory (SUDO): https://sudo.eresearch.unimelb.edu.au/
- Huge Twitter Corpse: https://www.dropbox.com/s/r6l4ke6h858bzph/twitter-huge.json.zip?dl=0
- Mastodon Servers:
    - Social: https://mastodon.social
    - AU: https://mastodon.au
    - Tic Toc: https://tictoc.social

## Scenarios

1. Examine the distribution of tweets discussing income inequality, financial struggles, or job satisfaction across different income brackets. Identify geolocations with higher median incomes and compare the sentiment of tweets in these areas to those with lower median incomes.
2. Analyze the relationship between criminal incidents by principal offence and the frequency of tweets discussing crime or safety in specific geolocations. Investigate how the sentiment of these tweets varies across areas with different crime rates.

## Special Thanks

- Basic project setup for database: https://gitlab.unimelb.edu.au/feit-comp90024/comp90024/-/tree/master/
- 2023 Twitter Processing Assignment 1 Code from [rNLKJA](https://github.com/rNLKJA/Unimelb-Master-2023-COMP90024-Assignment-1)
- Team Unknown from 2020 S1 CCC course: https://github.com/Olivia0012/CloudComputing

## License

The code will be public after 27th May 2023. For @copyright information please refer to MIT License.

---
<p alignright>Team 57</p>
