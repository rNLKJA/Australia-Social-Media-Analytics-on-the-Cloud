<div align="center">

# Australia Social Media Analytics on the Cloud

A cloud-native dashboard that mines a large Twitter corpus, harvested Mastodon data, and official **SUDO** statistics to tell stories about life in Australia — built for the University of Melbourne **COMP90024 Cluster and Cloud Computing** assignment 2 (Semester 1, 2023).

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-Backend-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![CouchDB](https://img.shields.io/badge/CouchDB-Cluster-E42528?style=for-the-badge&logo=apachecouchdb&logoColor=white)](https://couchdb.apache.org/)
[![Ansible](https://img.shields.io/badge/Ansible-Automation-EE0000?style=for-the-badge&logo=ansible&logoColor=white)](https://www.ansible.com/)
[![Docker](https://img.shields.io/badge/Docker-Swarm-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![University of Melbourne](https://img.shields.io/badge/University%20of%20Melbourne-COMP90024-094183?style=for-the-badge)](https://handbook.unimelb.edu.au/2023/subjects/comp90024)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## Overview

This project builds an end-to-end, cloud-deployed analytics platform — the **Social Sense Dashboard** — on the Melbourne Research Cloud (MRC). It combines three data sources to explore how social media chatter lines up with official statistics about Australian life:

- A large **Twitter corpus** provided by the university and the Australian Data Observatory ([ADO](https://www.ado.eresearch.unimelb.edu.au)).
- **Mastodon** data harvested directly from public servers via their APIs.
- Official spatial and demographic data from the **Spatial Urban Data Observatory** ([SUDO](https://sudo.eresearch.unimelb.edu.au)).

Tweets and toots are geocoded to Victorian suburbs (SAL boundaries), run through sentiment analysis, and compared against SUDO median-income and crime figures. The whole stack runs as a distributed system: a CouchDB cluster for storage, a Flask API for serving processed data, a React dashboard for visualisation, and Ansible plus Docker Swarm to provision and scale it all on the cloud.

The work was completed by **Team 57** for COMP90024, Semester 1, 2023.

### Research scenarios

1. **Income and sentiment** — examine the distribution of tweets discussing income inequality, financial struggle, or job satisfaction across income brackets, and compare sentiment in higher-income versus lower-income areas.
2. **Crime and sentiment** — analyse the relationship between recorded criminal incidents and the frequency and sentiment of tweets discussing crime or safety, area by area.

## Highlights

- **Distributed, fault-tolerant storage** — a multi-node CouchDB cluster deployed across MRC instances with mounted volumes and replicated databases.
- **Parallel big-data processing** — the huge Twitter corpus is processed with **MPI**, streaming line-by-line and loading clean, geocoded, sentiment-scored tweets into CouchDB.
- **Live Mastodon harvesting** — Python harvesters wrap multiple Mastodon servers (social, AU, tictoc, and more) to fetch and stream toots into the database.
- **Sentiment analysis** — tweets and toots are scored and aggregated by suburb for comparison against official statistics.
- **Interactive dashboard** — a React + Plotly frontend renders choropleth maps and summary charts of sentiment against SUDO income and crime data.
- **Infrastructure as code** — Ansible roles and playbooks provision MRC instances, build the CouchDB cluster, and deploy the frontend and backend as Docker Swarm services, with one-command scaling.

## Tech Stack

| Layer           | Technology                                          |
| :-------------- | :-------------------------------------------------- |
| Backend API     | Python 3.9+, Flask, Gunicorn (WSGI)                 |
| Frontend        | React.js, Plotly, Tailwind CSS, Nginx               |
| Database        | CouchDB 3.2.1 (clustered)                           |
| Data processing | Python, MPI (`mpi4py`), JupyterLab, MapReduce views |
| Sentiment       | Python sentiment analysis utilities                 |
| Infrastructure  | Ansible, Docker, Docker Swarm, OpenStack (MRC)      |
| Data sources    | Twitter corpus (ADO), Mastodon APIs, SUDO           |

## Repository Structure

The project is split into five components, each with its own README and detailed instructions:

```
Australia-Social-Media-Analytics-on-the-Cloud/
├── 1_Flask_Backend/          # Flask API + Mastodon harvester (Dockerised)
├── 2_ReactJS_frontend/       # React dashboard (Plotly maps and charts)
├── 3_CouchDB_database/       # CouchDB cluster deployment guide + compose
├── 4_Python_data_processing/ # MPI Twitter processing, Mastodon harvesting, notebooks
└── 5_Ansible_IT_Automation/  # Ansible roles/playbooks for MRC + Docker Swarm
```

## Getting Started

Each component can be run on its own; see the README inside each numbered folder for the full instructions. The quick paths are below.

### Prerequisites

- **Python** 3.9 or higher, with `pip`
- **Node.js** 14+ and npm (Node 14 is required to serve the production frontend build)
- **Docker** and Docker Compose
- **CouchDB** 3.2.1 (or run it via the provided Docker setup)
- **Ansible** and access to an OpenStack cloud (MRC) for full deployment
- An MPI implementation (e.g. OpenMPI) for the large Twitter processing job

Several components read connection details (CouchDB URL, credentials, Mastodon tokens) from a `.env` file. Create one in the relevant folder before running.

### Backend (Flask API)

```bash
cd 1_Flask_Backend/flask-backend
docker build -t flaskapp .
docker run -p 8080:8080 flaskapp
# API available at http://localhost:8080
```

### Frontend (React dashboard)

```bash
cd 2_ReactJS_frontend/frontend
npm install
npm start            # development server on http://localhost:3000

npm run build        # production build
serve -s build       # serve the static build (Node.js 14 recommended)
```

### CouchDB cluster

```bash
cd 3_CouchDB_database
docker-compose up -d
# then follow the step-by-step cluster setup in 3_CouchDB_database/README.md
```

### Twitter data processing (MPI)

```bash
cd 4_Python_data_processing
pip install -r requirements.txt
# place twitter_huge.json under the data/ folder, then:
mpiexec -n <NUM_PROCESSORS> python3 scripts/bigTwitterProcessingV1.py -t twitter_huge
```

### Deployment (Ansible + Docker Swarm)

```bash
cd 5_Ansible_IT_Automation/ansible
# update inventory/inventory.ini and host_vars/ with your MRC instance details
ansible-playbook -i inventory/inventory.ini playbooks/deploy_swarm.yaml
```

## Team 57

| Name              | Student ID |
| :---------------- | :--------- |
| Zongchao Xie      | 1174047    |
| Xuan Wang         | 1329456    |
| Runqiu Fei        | 1166093    |
| Wei Zhao          | 1118649    |
| Sunchuangyu Huang | 1118472    |

## Acknowledgements

- Base database setup from the [FEIT COMP90024 GitLab](https://gitlab.unimelb.edu.au/feit-comp90024/comp90024/-/tree/master/).
- Twitter processing logic adapted from the [2023 COMP90024 Assignment 1](https://github.com/rNLKJA/Unimelb-Master-2023-COMP90024-Assignment-1).
- Inspired by Team Unknown's [2020 S1 CCC project](https://github.com/Olivia0012/CloudComputing).

## License

Released under the [MIT License](LICENSE).

<div align="right"><sub>Team 57 · COMP90024 · University of Melbourne</sub></div>
