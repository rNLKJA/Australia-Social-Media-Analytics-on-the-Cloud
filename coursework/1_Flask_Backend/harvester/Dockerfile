FROM python:3.11.3

WORKDIR /harvester

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "mastodon/harvester.py"]
