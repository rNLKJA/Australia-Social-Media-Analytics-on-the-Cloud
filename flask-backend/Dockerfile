# Use the official Python image as a parent image
FROM python:3.10.6-slim-buster

# Set the working directory to /app
WORKDIR /flask-backend

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

EXPOSE  8080

CMD [ "gunicorn", "--bind", "0.0.0.0:8080", "app:app" ]