FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY renderer.py /app/renderer.py
RUN useradd --uid 10001 renderer && mkdir /data && chown renderer /data
USER renderer
ENV RENDERER_DATA=/data
EXPOSE 8090
CMD ["python3", "renderer.py"]