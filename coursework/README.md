# coursework/: the original 2023 submission

This folder is the Team 57 submission for COMP90024 Cluster and Cloud Computing (University of Melbourne, Semester 1 2023, Assignment 2: *Australia Social Media Analytics on the Cloud*). It was moved here with `git mv` in 2026 so its history is intact, and nothing was edited during the revival. (Earlier in 2026 the code was reformatted with black, isort and prettier; no logic changed.) The revived web app lives in [`../web`](../web) and the scripts that re-run this code in [`../scripts`](../scripts).

| Folder / file | What it is |
| --- | --- |
| `1_Flask_Backend/` | Flask API (`flask-backend/app.py`) that turned CouchDB view results and SUDO CSVs into gzipped Plotly figures, plus the Dockerised Mastodon harvester (`harvester/`). |
| `2_ReactJS_frontend/` | React 18 dashboard (MUI, Plotly, Tailwind). `frontend/public/` holds the precomputed Plotly JSON it displayed; these files are the reference outputs the revival is checked against. |
| `3_CouchDB_database/` | `docker-compose.yml` and the step-by-step guide for the three-node CouchDB 3.2.1 cluster. |
| `4_Python_data_processing/` | MPI tweet processor (`scripts/bigTwitterProcessingV*.py`), the NLP scoring code (`scripts/sentimental_analysis/analyzer.py`), SAL geocoding (`scripts/twitter/`), CouchDB MapReduce views (`scripts/MapReduce/`), Mastodon API notebooks and the suburb dictionary (`data/sal.processed.dict.pkl`). |
| `5_Ansible_IT_Automation/` | Ansible roles and playbooks that create the Melbourne Research Cloud instances, volumes and security groups, form the CouchDB cluster and deploy the services on Docker Swarm. |
| `Report.pdf` | The team's 25-page report. |
| `_archive/README.original.md` | The repository README as submitted. |
| `pyproject.toml`, `.prettierrc`, `.prettierignore` | Formatter settings from that clean-up. |

## Running it today

The system was built for infrastructure that no longer exists (the MRC project, its CouchDB cluster and the University's Twitter corpus), so it cannot be redeployed as-is. The components can still be run locally for study. Several of them expect a `.env` file with CouchDB and Mastodon credentials; none is included and none should be committed.

**Flask backend**

```bash
cd coursework/1_Flask_Backend/flask-backend
docker build -t flaskapp .
docker run -p 8080:8080 flaskapp        # http://localhost:8080
```

**React dashboard** (Node 14 for the production build, as in 2023)

```bash
cd coursework/2_ReactJS_frontend/frontend
npm install
npm start                               # http://localhost:3000
```

**CouchDB cluster**

```bash
cd coursework/3_CouchDB_database
docker-compose up -d                    # then follow README.md in that folder
```

**Twitter processing (MPI)**

```bash
cd coursework/4_Python_data_processing
pip install -r requirements.txt
# place the corpus at data/twitter_huge.json, then:
mpiexec -n <NUM_PROCESSORS> python3 scripts/bigTwitterProcessingV2.py -t twitter_huge
```

**Ansible deployment**

```bash
cd coursework/5_Ansible_IT_Automation/ansible
# fill in inventory/inventory.ini and host_vars/ for your OpenStack project
./step1_run_mrc.sh && ./step2_a_create_couchdb.sh   # and so on, see that README
```

Relative paths inside each component were preserved by moving the folders together, so the commands above work from their new location.

## How the revival uses this code

`scripts/build_nlp_assets.py`, `scripts/build_mastodon.py` and `scripts/build_analytics.py` import the original modules from this folder unchanged (for example `analyzer.normalize_string` and `analyzer.sentiment_analysis`) or replicate the Flask functions line by line, and fail if their output differs from the Plotly figures in `2_ReactJS_frontend/frontend/public`. See [`../scripts/README.md`](../scripts/README.md).

## Academic integrity

This is coursework by Zongchao Xie, Xuan Wang, Runqiu Fei, Wei Zhao and Sunchuangyu Huang, kept for reference and portfolio purposes. Please do not submit any part of it as your own work.
