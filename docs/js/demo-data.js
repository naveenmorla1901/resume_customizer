// Starter resume content. Contact details are intentionally blank and stay local.
// Replace or edit content through Settings → Import resume.
export const STARTER_MASTER = {
  "schemaVersion": 1,
  "profile": {
    "name": "Naveen Morla",
    "phone": "",
    "email": "",
    "links": [
      {
        "label": "linkedin.com/in/Naveen-Morla",
        "url": "https://linkedin.com/in/Naveen-Morla"
      },
      {
        "label": "github.com/naveenmorla1901",
        "url": "https://github.com/naveenmorla1901"
      },
      {
        "label": "Portfolio",
        "url": "https://naveenmorla1901.github.io/"
      }
    ]
  },
  "summary": "Data Scientist with 5+ years of experience building production ML and GenAI systems, end to end ML pipelines, LLM powered applications, and scalable APIs across manufacturing, legal, and analytics domains. Deep expertise in RAG pipelines, Agentic AI workflows, multi agent systems, model deployment, MLOps, FastAPI, and multi provider LLM systems (Claude, Gemini, GPT, Llama, DeepSeek, Qwen) with production deployments on AWS and Azure.",
  "experience": [
    {
      "id": "lisinski",
      "title": "Data Scientist, Business Intelligence",
      "company": "Lisinski Law Firm LLC",
      "dates": "Jun 2025 – Present",
      "bullets": [
        "Developed and maintained **forecasting models** to predict case growth and business development trends across **50,000+ active cases**, leveraging advanced statistical and ML techniques to support strategic decision making for 15+ leadership stakeholders.",
        "Deployed **LLM based sentiment analysis** on client and case data using **Azure Functions** and Python, automating reporting workflows and enabling real time insights that improved business development strategies and client experience outcomes.",
        "Designed and maintained interactive **Power BI dashboards** tracking 15+ KPIs across **50,000+ active immigration case pipelines**, reducing manual reporting cycles and enabling faster, data driven decisions for 15+ leadership stakeholders.",
        "Engineered high performance **FastAPI** endpoints and scalable **data pipelines** using Azure Functions and Python, optimizing response times and supporting **real time analytics** consumption across BI applications.",
        "Designed and implemented end to end **CI/CD pipelines** for automated deployment of data science models and APIs to Azure, cutting release cycle time and eliminating manual deployment errors across all production environments."
      ]
    },
    {
      "id": "thk",
      "title": "Data Scientist / Software Engineer",
      "company": "THK Manufacturing of America Inc",
      "dates": "Jan 2024 – Jun 2025",
      "bullets": [
        "Engineered high performance **FastAPI** APIs with advanced caching for seamless ingestion, processing, and retrieval of machine and inventory datasets, reducing data retrieval latency and supporting real time analytics across production manufacturing systems.",
        "Fine tuned predictive models with **PyTorch** and **TensorFlow**, improving lead time forecasting accuracy by **18%** and optimizing inventory management across **5,000+ SKUs**.",
        "Engineered data preprocessing pipelines with feature engineering and data wrangling to improve model accuracy and robustness, leveraging **Polars** and **PySpark** to process **100M+ rows**, enabling real time analytics on large scale inventory and sensor datasets.",
        "Architected and managed containerized **microservices** with **Kubernetes** and **Docker** for scalable big data processing pipelines handling **1TB+** of daily manufacturing data, implementing **MLOps** practices to streamline deployment and monitoring of machine learning models.",
        "Built interactive **Tableau** dashboards and responsive **React** and **JavaScript** frontend interfaces, enabling self service analytics and reducing ad hoc reporting requests from cross functional manufacturing stakeholders.",
        "Designed and optimized complex **SQL** schemas and queries for high performance data management, and established **CI/CD pipelines** with GitHub Actions achieving automated testing and zero downtime continuous deployment."
      ]
    },
    {
      "id": "pago",
      "title": "Data Scientist",
      "company": "Pago Analytics",
      "dates": "May 2019 – Apr 2021",
      "bullets": [
        "Designed and deployed a **deep learning resume parser** using Python, NLTK, and SpaCy, improving hiring process efficiency by **30%** and reducing hiring costs by **22%**, cutting the end to end hiring cycle by two weeks across **10,000+ labeled resumes**.",
        "Built and deployed an automated Talent Acquisition Management System (TAMS) on **AWS SageMaker**, training on 10,000+ resumes to automate candidate screening and achieve **30%** faster project delivery under Agile workflows.",
        "**Normalized** SQL databases improving data handling and query performance by 2X, defined KPIs and delivered insights via **Power BI** dashboards, increasing stakeholder engagement by 30% and reducing decision making time by **18%**.",
        "Leveraged advanced data mining and ML techniques to identify critical business metrics, communicated findings to cross functional stakeholders through **Power BI** reports, achieving 25% faster project completion across concurrent hiring initiatives."
      ]
    },
    {
      "id": "km",
      "title": "Data Analyst",
      "company": "Knowledge Matrix Pvt Ltd",
      "dates": "Mar 2018 – Feb 2019",
      "bullets": [
        "Built an **ETL pipeline** using Python, SQL, Spark, and Hadoop to process **10M+** records, reducing processing time by 5+ hours per batch and improving overall data accuracy by 20%.",
        "Designed Tableau and Power BI dashboards deployed on AWS, directly contributing to a **25% increase** in conversion rates and a 15% reduction in customer attrition through **data driven sales** and marketing decisions.",
        "Partnered with business units to define data requirements and governance standards, ensuring data redundancy and reliability across **Hadoop** ecosystems and resulting in **20% improvement** in data accuracy and consistency.",
        "Ran **A/B tests** and **hypothesis evaluations** on AWS to guide product strategy, applied predictive analytics and ML techniques to identify patterns and anomalies, enabling forward looking business recommendations."
      ]
    }
  ],
  "projects": [
    {
      "id": "job-tracker",
      "name": "Job Tracker",
      "tech": "FastAPI, PostgreSQL, Streamlit, APScheduler, GitHub Actions, Nginx",
      "bullets": [
        "Built a full stack job tracking platform that **auto scrapes 140+ company** career portals hourly using Python, persisting **10,000+ postings** in PostgreSQL with automatic cleanup of records older than 7 days.",
        "Engineered FastAPI backend with rate limiting, pagination, and **RESTful** APIs, implemented **CI/CD** pipelines via GitHub Actions and deployed on Oracle Cloud Infrastructure with **Nginx** reverse proxy for production access.",
        "Developed interactive **Streamlit** dashboard with real time filtering (role, company, location), dark mode toggle, mobile responsive layout, and a system monitoring interface tracking CPU, memory, and disk usage."
      ]
    },
    {
      "id": "auto-scrapper",
      "name": "Auto Scrapper",
      "tech": "LangChain, Playwright, BeautifulSoup, Docker",
      "bullets": [
        "Developed an **LLM powered** intelligent web scraping tool that **auto generates** and iteratively refines scraping code from natural language descriptions, supporting GPT, Claude, and Gemini as interchangeable backends via LangChain.",
        "Integrated Gemini Flash for automated website structure analysis, implemented **sandboxed** code execution with real time token usage tracking and interactive status updates on a FastAPI + Bootstrap frontend.",
        "Containerized the full application with **Docker** for consistent cross environment deployment, designed a modular multi provider architecture with automatic error recovery and **code refinement loops**."
      ]
    },
    {
      "id": "rag-llm-loan-document-processing",
      "name": "RAG LLM (Loan Document Processing)",
      "tech": "AWS Bedrock, ChromaDB, LangChain",
      "bullets": [
        "Architected a **Retrieval Augmented Generation** system for intelligent loan document Q&A using **AWS Bedrock** Titan embeddings for semantic vector search over PDF and CSV documents stored in ChromaDB.",
        "Implemented **multi LLM** with automatic **fallback chains**, exponential backoff retries, and full source reference tracking for auditability of **AI generated responses**.",
        "Engineered a scalable document ingestion pipeline with embedding caching, batch processing optimization, and **progress tracking**, reducing repeated computation overhead and accelerating large file processing."
      ]
    },
    {
      "id": "gnn-graph-neural-network-anomaly-detection",
      "name": "GNN (Graph Neural Network Anomaly Detection)",
      "tech": "Python, PyTorch, GNN",
      "bullets": [
        "Developed a **Graph Neural Network** based anomaly detection system for multivariate time series, leveraging graph structured representations to model complex inter sensor dependencies for **industrial IoT** datasets.",
        "Designed graph construction from sensor correlation matrices and trained GNN models to identify anomalous **temporal patterns**, outperforming traditional statistical baselines in detection accuracy.",
        "**Open sourced** the implementation achieving 3 GitHub stars and 1 fork, demonstrating practical applicability of **graph deep learning** for predictive maintenance in manufacturing environments."
      ]
    }
  ],
  "skills": [
    {
      "label": "Languages",
      "items": [
        "Python",
        "SQL",
        "R",
        "JavaScript",
        "Scala"
      ]
    },
    {
      "label": "AI & ML",
      "items": [
        "Machine Learning",
        "Deep Learning",
        "LLM Agents",
        "RAG Pipelines",
        "GenAI",
        "Agentic AI Workflows",
        "Multi Agent Systems",
        "MLOps",
        "Prompt Engineering",
        "Fine Tuning (LoRA)",
        "NLP (Natural Language Processing)",
        "Computer Vision",
        "Reinforcement Learning",
        "Multimodal AI",
        "A/B Testing",
        "Big Data"
      ]
    },
    {
      "label": "Frameworks & Libraries",
      "items": [
        "PyTorch",
        "TensorFlow",
        "Scikit Learn",
        "Hugging Face Transformers",
        "BERT",
        "Pandas",
        "NumPy",
        "NLTK",
        "SpaCy",
        "Polars",
        "PySpark",
        "Airflow",
        "Apache Kafka",
        "Redis",
        "Streamlit",
        "FastAPI",
        "Flask",
        "Plotly",
        "Git"
      ]
    },
    {
      "label": "LLM & Vector Stack",
      "items": [
        "LangChain",
        "LangGraph",
        "LangSmith",
        "LlamaIndex",
        "DSPy",
        "CrewAI",
        "AutoGen",
        "ChromaDB",
        "FAISS",
        "Pinecone",
        "AWS Bedrock",
        "OpenAI API",
        "Anthropic API"
      ]
    },
    {
      "label": "Databases",
      "items": [
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Cassandra",
        "Elasticsearch",
        "DynamoDB",
        "Snowflake",
        "Databricks",
        "Redshift"
      ]
    },
    {
      "label": "Cloud",
      "items": [
        "AWS (SageMaker, Bedrock, S3, EC2, Lambda, EMR, Kinesis)",
        "Azure (Functions, Azure ML, CI/CD)",
        "GCP (Vertex AI, BigQuery)",
        "Oracle Cloud"
      ]
    },
    {
      "label": "DevOps & MLOps",
      "items": [
        "Docker",
        "Kubernetes",
        "MLflow",
        "Weights & Biases",
        "Model Monitoring",
        "Drift Detection",
        "GitHub Actions",
        "CI/CD",
        "Terraform",
        "Prometheus",
        "Grafana",
        "Nginx"
      ]
    },
    {
      "label": "Statistics & Algorithms",
      "items": [
        "Hypothesis Testing",
        "Time Series Analysis",
        "Regression (Linear/Logistic/Ridge/Lasso)",
        "Decision Trees",
        "Random Forests",
        "XGBoost",
        "LGBM",
        "Predictive Analytics"
      ]
    }
  ],
  "education": {
    "school": "BOWLING GREEN STATE UNIVERSITY, OHIO",
    "dates": "Aug 2021 – May 2023",
    "degree": "M.S. in Data Science",
    "coursework": "Data Science Programming, Database Management Systems, Regression Analysis, Data Mining, Time Series Analysis, Artificial Intelligence Methods, Probability Theory I, Mathematical Statistics II, Linear and Integer Programming, Data Science Project"
  },
  "certifications": [
    {
      "org": "Coursera",
      "items": "Python and Machine Learning, Introduction to Data Analytics."
    },
    {
      "org": "Udemy",
      "items": "Tableau, Power BI, Django."
    },
    {
      "org": "DataCamp",
      "items": "Introduction to R Programming, Statistics in Spreadsheets and Excel."
    }
  ],
  "meta": {
    "sourceFile": "Naveen_Morla_Resume.docx",
    "sourceFormat": "Word / Calibri / US Letter / 2 pages",
    "starter": true,
    "updated": "2026-11-16"
  }
};

export const SAMPLE_JD = "Data Scientist — Legal Analytics (Remote)\n\nWe are looking for a Data Scientist to build forecasting, LLM, and BI solutions for a fast-growing legal services company. You will own models end to end, partner with leadership, and turn 50,000+ case records into actionable insights.\n\nRequired:\n- 4+ years of experience with Python, SQL, and machine learning\n- Strong forecasting, regression, and time series skills\n- Experience with LLMs, RAG, prompt engineering, and NLP\n- Power BI or Tableau dashboards for executive stakeholders\n- FastAPI or Flask APIs and data pipelines\n- Azure (Functions, Azure ML) or AWS (SageMaker, Bedrock)\n- CI/CD, Docker, Git, and production MLOps\n\nPreferred:\n- LangChain, LangGraph, vector databases such as ChromaDB or FAISS\n- Databricks, Snowflake, or PostgreSQL\n- Experience in legal, insurance, or professional services\n";
