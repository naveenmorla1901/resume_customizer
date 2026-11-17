/**
 * Project library for resume tailoring.
 *
 * Every entry maps to a real repository, live site, or documented project.
 * `featured: true` projects are shown in the untailored two-page preview;
 * tailoring can select any four projects from the full library and orders
 * them by relevance to the job description.
 *
 * Keep bullets factual. The app is allowed to reorder and emphasize existing
 * evidence, but it must never invent a project, tool, metric, or outcome.
 */
export const PROJECT_LIBRARY = [
  {
    id: 'inbox-job-agent',
    name: 'Inbox Job Agent',
    tech: 'Python, Gmail API, SQLModel, PostgreSQL, BeautifulSoup, LLM, Cloud Run, Telegram',
    link: 'https://github.com/naveenmorla1901/inbox-job-agent',
    featured: false,
    bullets: [
      'Built an end-to-end **data engineering pipeline** that polls Gmail incrementally, parses MIME job-alert digests, unwraps tracking links, and persists de-duplicated postings in SQLite/PostgreSQL.',
      'Applied **data modeling** to design a normalized schema for messages, postings, applications, outreach, and poll runs using SQLModel, with indexed lookups and transactional per-message writes.',
      'Implemented a rules-first classifier with optional **LLM** refinement, a fallback job-page extractor (Greenhouse/Lever JSON, JSON-LD, HTML), and a 0-100 relevance score; deployed on Cloud Run with Telegram alerts.',
    ],
  },
  {
    id: 'job-tracker',
    name: 'Job Tracker',
    tech: 'Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, APScheduler, Streamlit, GitHub Actions, Nginx',
    link: 'https://github.com/naveenmorla1901/job-tracker',
    featured: true,
    bullets: [
      'Engineered a **data engineering** platform that runs hourly scrapers across **320+ company career sites**, upserts postings into PostgreSQL, and retires stale records on a 7-day window.',
      'Applied **data modeling** to design a normalized schema for jobs, companies, roles, scrape runs, and user tracking, enforced through foreign keys, unique constraints, indexes, and Alembic migrations.',
      'Built **FastAPI** APIs with pagination and rate limiting, a **Streamlit** dashboard, and GitHub Actions/Nginx deployment on Oracle Cloud for automated operations.',
    ],
  },
  {
    id: 'auto-scrapper',
    name: 'Auto Scrapper',
    tech: 'LangChain, Playwright, BeautifulSoup, FastAPI, Docker, Gemini, OpenAI, Claude',
    link: 'https://github.com/naveenmorla1901/auto-scrapper',
    featured: true,
    bullets: [
      'Developed an **LLM powered** intelligent web scraping tool that **auto generates** and iteratively refines scraping code from natural language descriptions, supporting GPT, Claude, and Gemini as interchangeable backends via LangChain.',
      'Integrated Gemini Flash for automated website structure analysis, implemented **sandboxed** code execution with real time token usage tracking and interactive status updates on a FastAPI + Bootstrap frontend.',
      'Containerized the full application with **Docker** for consistent cross environment deployment, designed a modular multi provider architecture with automatic error recovery and **code refinement loops**.',
    ],
  },
  {
    id: 'rag-llm-loan-document-processing',
    name: 'RAG LLM (Loan Document Processing)',
    tech: 'AWS Bedrock, ChromaDB, LangChain, Python',
    link: 'https://github.com/naveenmorla1901/RAG-LLM',
    featured: true,
    bullets: [
      'Architected a **Retrieval Augmented Generation** system for intelligent loan document Q&A using **AWS Bedrock** Titan embeddings for semantic vector search over PDF and CSV documents stored in ChromaDB.',
      'Implemented **multi LLM** with automatic **fallback chains**, exponential backoff retries, and full source reference tracking for auditability of **AI generated responses**.',
      'Engineered a scalable document ingestion pipeline with embedding caching, batch processing optimization, and **progress tracking**, reducing repeated computation overhead and accelerating large file processing.',
    ],
  },
  {
    id: 'resume-customizer',
    name: 'Resume Customizer',
    tech: 'JavaScript, HTML/CSS, DeepSeek, Cloudflare Workers, GitHub Actions, docx.js',
    link: 'https://github.com/naveenmorla1901/resume_customizer',
    featured: false,
    bullets: [
      'Built an ATS-focused resume tailoring app that analyzes job descriptions, ranks existing experience and project evidence, and produces a **two-page DOCX/PDF** without inventing facts.',
      'Implemented **project selection** from a GitHub project library, keyword-gap reporting, deterministic ATS scoring, and a two-page fitting pass that trims only lower-priority content.',
      'Added a **Cloudflare Worker** proxy so AI requests use a server-side DeepSeek key; the key never reaches the browser, and the app deploys through GitHub Actions and Pages.',
    ],
  },
  {
    id: 'omni-relay',
    name: 'ClearRelay',
    tech: 'TypeScript, React Native, Expo, WebRTC, WebSocket, Node.js, Zustand, GitHub Actions, Railway',
    link: 'https://github.com/naveenmorla1901/omni-relay',
    featured: false,
    bullets: [
      'Built a serverless **WebRTC** screen-relay app with Recorder, Admin, and Projector roles, 6-character room pairing, automatic reconnection, and peer-to-peer media without a media server.',
      'Implemented an Expo/React Native web and Android client with a versioned **TypeScript** wire protocol, Zustand state, camera controls, and a Node.js WebSocket signaling service on Railway.',
      'Added CV-based still capture (sharpest-of-five frames, CLAHE, unsharp mask), live projector composition, and CI/CD for web deploys and tagged Android APK builds.',
    ],
  },
  {
    id: 'gnn-graph-neural-network-anomaly-detection',
    name: 'GNN (Graph Neural Network Anomaly Detection)',
    tech: 'Python, PyTorch, PyTorch Geometric, GNN',
    link: 'https://github.com/naveenmorla1901/GNN',
    featured: true,
    bullets: [
      'Developed a **Graph Neural Network** based anomaly detection system for multivariate time series, leveraging graph structured representations to model complex inter sensor dependencies for **industrial IoT** datasets.',
      'Designed graph construction from sensor correlation matrices and trained GNN models to identify anomalous **temporal patterns**, outperforming traditional statistical baselines in detection accuracy.',
      '**Open sourced** the implementation achieving 3 GitHub stars and 1 fork, demonstrating practical applicability of **graph deep learning** for predictive maintenance in manufacturing environments.',
    ],
  },
  {
    id: 'memory-map-v0',
    name: 'Memory Map',
    tech: 'React Native, Expo, TypeScript, Maps',
    link: 'https://github.com/naveenmorla1901/memory-map-v0',
    featured: false,
    bullets: [
      'Built a cross-platform **React Native/Expo** location-memory app for saving and exploring places on a map, with Android/iOS builds and a TypeScript codebase.',
      'Implemented map-based location storage and retrieval with reusable React Native components and a mobile-first interface.',
    ],
  },
  {
    id: 'cricket',
    name: 'Cricket Stats',
    tech: 'Python, Selenium, BeautifulSoup, pandas, JSON, GitHub Actions, GitHub Pages',
    link: 'https://github.com/naveenmorla1901/cricket',
    featured: false,
    bullets: [
      'Built a Python **web scraping** pipeline using Selenium, BeautifulSoup, and pandas to extract batting, bowling, fielding, and ranking data across multiple club leagues.',
      'Published the cleaned JSON datasets through a static **GitHub Pages** dashboard and automated seasonal refreshes with GitHub Actions.',
    ],
  },
  {
    id: '2d-paths',
    name: '2D Paths',
    tech: 'Python, NumPy, imageio, BFS, Jupyter',
    link: 'https://github.com/naveenmorla1901/2D_paths',
    featured: false,
    bullets: [
      'Implemented a **BFS pathfinding** library for black-and-white grid images, including single-path search, two non-intersecting paths, and PNG visualization.',
      'Added a CLI and interactive notebook for selecting start/end pixels; used NumPy and imageio for image processing.',
    ],
  },
  {
    id: 'cs-6010',
    name: 'MRI CNN (MGMT Classification)',
    tech: 'Python, TensorFlow, Keras, CNN, TensorBoard',
    link: 'https://github.com/naveenmorla1901/CS-6010',
    featured: false,
    bullets: [
      'Built a four-input **3D CNN** in TensorFlow/Keras that fuses FLAIR, T1w, T1wCE, and T2w MRI volumes to predict MGMT status in glioblastoma patients.',
      'Implemented preprocessing/data generators, trained with TensorBoard, checkpointing, and early stopping on 585 patients; documented that the model did not beat chance.',
    ],
  },
  {
    id: 'data-science-samples',
    name: 'Data Science Samples',
    tech: 'Python, scikit-learn, pandas, Jupyter, pyresparser',
    link: 'https://github.com/naveenmorla1901/DataScience_Sample_Projects',
    featured: false,
    bullets: [
      'Built classical ML notebooks covering decision trees, KNN regression, and logistic regression with preprocessing, model training, and evaluation on public datasets.',
      'Implemented batch resume parsing with pyresparser to extract structured candidate details from PDF, DOCX, and TXT files.',
    ],
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    tech: 'Next.js, TypeScript, Tailwind CSS, GitHub API, GitHub Pages',
    link: 'https://naveenmorla1901.github.io/',
    featured: false,
    bullets: [
      'Built a statically exported Next.js/TypeScript portfolio with case-study project cards, live GitHub stats, a command palette, JSON-LD SEO, and responsive light/dark themes.',
      'Automated deployment to GitHub Pages through GitHub Actions with a single typed content source for projects, experience, and skills.',
    ],
  },
];

export default PROJECT_LIBRARY;
