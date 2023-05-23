# Use the official Python image as a parent image
FROM python:3.11.3


# Install GDAL dependencies
RUN apt-get update \
    && apt-get install -y gdal-bin libgdal-dev
    
# Set the working directory to /app
WORKDIR /flask-backend

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

EXPOSE 8080

CMD ["gunicorn", "--worker-class=gevent", "--worker-connections=1000", "--workers=5", "--bind", "0.0.0.0:8080", "app:app", "--timeout", "180"]

# Use the official Python image as a parent image
FROM python:3.11.3

# Update the package lists for upgrades for security purposes
RUN apt-get update -y 

# Install GDAL dependencies
RUN apt-get install -y --no-install-recommends gdal-bin libgdal-dev

# Set the working directory to /app
WORKDIR /flask-backend

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

EXPOSE 8080

CMD ["gunicorn", "--worker-class=gevent", "--worker-connections=1000", "--workers=5", "--bind", "0.0.0.0:8080", "app:app", "--timeout", "180"]

# Clean up
RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/*
