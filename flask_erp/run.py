from app import create_app

app = create_app()

if __name__ == '__main__':
    # Running on 5001 to avoid conflict with existing node backend on 3001
    app.run(host='0.0.0.0', port=5001, debug=True)
