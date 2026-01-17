import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Joyride, { STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { useTheme, alpha } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

// Storage key for tour state
const TOUR_STORAGE_KEY = 'prism_tour_completed';
const TOUR_DONT_SHOW_KEY = 'prism_tour_dont_show';

// Tour steps configuration - Comprehensive full app tour
export const TOUR_STEPS = {
  // Welcome step
  WELCOME: [
    {
      target: 'body',
      content: (
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem' }}>👋 Welcome to Prism!</h2>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Let's take a quick tour to help you get started with automatic API generation from your databases.
          </p>
          <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            This tour will guide you through all features across every page.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ],

  // Sidebar & Connections
  SIDEBAR: [
    {
      target: '[data-tour="sidebar"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📁 Connections Sidebar</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Manage all your database connections here. You can add MySQL, PostgreSQL, and other databases.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Click on a connection to select it, or use the buttons to disconnect/delete.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="new-connection-btn"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>➕ Add New Connection</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Click here to add a new database connection. You'll need to provide:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li>Host & Port</li>
            <li>Username & Password</li>
            <li>Database name</li>
          </ul>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
  ],

  // Navigation
  NAVIGATION: [
    {
      target: '[data-tour="nav-tabs"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🧭 Navigation Tabs</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Navigate between different sections of the app:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Dashboard</strong> - Overview & metrics</li>
            <li><strong>Schema</strong> - Browse tables & data</li>
            <li><strong>ER Diagram</strong> - Visualize relationships</li>
            <li><strong>APIs</strong> - Test & build endpoints</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="theme-toggle"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🌓 Theme Toggle</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Switch between dark and light mode based on your preference.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
  ],

  // Dashboard Page
  DASHBOARD: [
    {
      target: '[data-tour="dashboard-metrics"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📊 Key Metrics</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            View important statistics about your connected database:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Tables</strong> - Total tables in database</li>
            <li><strong>Columns</strong> - Total columns across all tables</li>
            <li><strong>Relations</strong> - Foreign key relationships</li>
            <li><strong>Endpoints</strong> - Auto-generated API endpoints</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="quick-actions"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>⚡ Quick Actions</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Access frequently used features quickly. Jump directly to Schema Browser, ER Diagram, or API Explorer.
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="database-breakdown"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📈 Database Breakdown</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            See detailed information about your connected databases. Switch between viewing current connection or all connections.
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
  ],

  // Schema Page
  SCHEMA: [
    {
      target: '[data-tour="schema-search"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🔍 Search Tables</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Quickly find tables by name. Start typing to filter the list of tables.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Use this to quickly navigate large databases with many tables.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="schema-tables"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📋 Database Tables</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Browse all tables in your database. <strong>Click on any table</strong> to expand and see:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li>Column names and data types</li>
            <li>Primary keys (🔑) and foreign keys (🔗)</li>
            <li>Default values and constraints</li>
            <li>Nullable columns and indexes</li>
          </ul>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="schema-table-actions"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🛠️ Table Actions</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Each table has quick action buttons:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>➕ Add Record</strong> - Opens a form to insert new data into this table</li>
            <li><strong>📄 View Data</strong> - Opens a modal to browse, edit, and delete existing records</li>
            <li><strong>📤 Export</strong> - Download the table schema as JSON for documentation</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            The View Data modal lets you paginate, sort, edit, and delete rows directly!
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
  ],

  // ER Diagram Page
  ER_DIAGRAM: [
    {
      target: '[data-tour="er-canvas"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🗺️ ER Diagram Canvas</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Visualize your database relationships! Each box represents a table with its columns.
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Drag canvas</strong> - Pan around to see all tables</li>
            <li><strong>Scroll wheel</strong> - Zoom in and out</li>
            <li><strong>Drag tables</strong> - Rearrange the layout manually</li>
            <li><strong>Lines</strong> - Show foreign key relationships (crow's foot notation)</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Tables show primary keys (🔑) and indicate relationship cardinality.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="er-toolbar"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🛠️ Diagram Toolbar</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Powerful tools for your ER diagram:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>📋 Copy Mermaid</strong> - Export diagram as Mermaid markdown code</li>
            <li><strong>📸 Export PNG</strong> - Download as high-quality image</li>
            <li><strong>🔄 Auto Layout</strong> - Automatically arrange tables neatly</li>
            <li><strong>⛶ Fullscreen</strong> - Expand diagram to full screen view</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="er-drawing"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>✏️ Whiteboard Drawing Mode</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Enable drawing mode to annotate your diagram directly!
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>🖊️ Pen Tool</strong> - Draw freehand annotations</li>
            <li><strong>🧹 Eraser</strong> - Remove drawing strokes</li>
            <li><strong>🎨 Colors</strong> - Choose from multiple pen colors</li>
            <li><strong>↩️ Undo/Redo</strong> - Fix mistakes easily</li>
            <li><strong>🗑️ Clear All</strong> - Remove all drawings at once</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Great for presentations and team discussions!
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
  ],

  // APIs Page
  APIS: [
    {
      target: '[data-tour="api-builder-btn"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🔧 Custom API Builder Button</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            <strong>Click this button</strong> to open the visual API Builder panel!
          </p>
          <p style={{ margin: '8px 0 0 0', opacity: 0.85 }}>
            The API Builder lets you create custom endpoints by:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li>Selecting specific fields from tables</li>
            <li>Adding WHERE filters and conditions</li>
            <li>Joining multiple tables together</li>
            <li>Adding GROUP BY and aggregations (SUM, COUNT, AVG)</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="api-saved"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>⭐ Your Saved APIs</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Custom APIs you've built appear here. Each saved endpoint shows:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Endpoint name</strong> - Your custom URL path</li>
            <li><strong>SQL Query</strong> - The underlying query that runs</li>
            <li><strong>Try It</strong> - Test the endpoint directly</li>
            <li><strong>Get Code</strong> - Get code snippets in multiple languages</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="api-list"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📡 Auto-Generated REST Endpoints</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Every table automatically gets full CRUD API endpoints:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><span style={{ color: '#4caf50', fontWeight: 600 }}>GET</span> - Fetch records with filters, pagination, sorting</li>
            <li><span style={{ color: '#2196f3', fontWeight: 600 }}>POST</span> - Create new records</li>
            <li><span style={{ color: '#ff9800', fontWeight: 600 }}>PUT</span> - Update existing records</li>
            <li><span style={{ color: '#f44336', fontWeight: 600 }}>DELETE</span> - Remove records</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Click <strong>"Try It"</strong> to open the API Tester panel, or <strong>"Get Code"</strong> for code snippets.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
  ],

  // API Builder Panel (when opened)
  API_BUILDER: [
    {
      target: '[data-tour="builder-schema"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📋 Schema Sidebar</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            <strong>Click on a table</strong> to add it to your API query!
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li>Browse all available tables</li>
            <li>See column info on hover</li>
            <li>Add multiple tables for JOINs</li>
          </ul>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="builder-canvas"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🎨 Query Builder Canvas</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Configure your API here after adding tables:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>✓ Toggle Fields</strong> - Select which columns to include</li>
            <li><strong>🔗 Joins</strong> - Auto-suggested based on foreign keys</li>
            <li><strong>🔎 Filters</strong> - Add WHERE conditions</li>
            <li><strong>📊 Group By</strong> - Group results by column</li>
            <li><strong>∑ Aggregates</strong> - Add SUM, COUNT, AVG, MIN, MAX</li>
            <li><strong>Having</strong> - Filter on aggregated values</li>
          </ul>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="builder-preview"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>👁️ Live Preview Panel</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            See a live preview of your API as you build it:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Generated SQL</strong> - See the exact query that will run</li>
            <li><strong>Preview Data</strong> - Sample results from your query</li>
            <li><strong>Expand/Collapse</strong> - Click the header to toggle</li>
            <li><strong>Save Button</strong> - Give your API a name and save it!</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Saved APIs appear in your Saved APIs list and can be called via REST.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
  ],

  // API Tester Panel (when opened)
  API_TESTER: [
    {
      target: '[data-tour="api-tester"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🧪 API Tester Panel</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Test your API endpoints live! This panel lets you:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>GET</strong> - Fetch and filter data</li>
            <li><strong>POST</strong> - Insert new records with a form</li>
            <li><strong>PUT</strong> - Update existing records</li>
            <li><strong>DELETE</strong> - Remove records (with filters)</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            The form adapts to each HTTP method automatically.
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="api-tester-filters"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>🔎 Query Filters & Options</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Refine your API requests with powerful filters:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Column Filters</strong> - Filter by any field using operators (=, !=, &gt;, LIKE, etc.)</li>
            <li><strong>Order By</strong> - Sort results ascending or descending</li>
            <li><strong>Pagination</strong> - Set page size and navigate pages</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Click "Additional Filters" to expand/collapse filter options.
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="api-tester-response"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>📤 Response Panel</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            After sending a request, see the results here:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>Status Code</strong> - 200 OK, 201 Created, 400 Error, etc.</li>
            <li><strong>Response Time</strong> - How long the request took</li>
            <li><strong>JSON Data</strong> - Interactive, collapsible JSON viewer</li>
            <li><strong>Row Count</strong> - Number of records returned</li>
          </ul>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
  ],

  // Code Snippets
  CODE_SNIPPETS: [
    {
      target: '[data-tour="code-snippets"]',
      content: (
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>💻 Code Snippets Panel</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Get ready-to-use code in multiple programming languages:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, opacity: 0.85, fontSize: '0.9rem' }}>
            <li><strong>JavaScript</strong> - fetch() and axios examples</li>
            <li><strong>Python</strong> - requests library</li>
            <li><strong>cURL</strong> - Command line</li>
            <li><strong>PHP</strong> - cURL and file_get_contents</li>
          </ul>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Code includes your current filters and parameters. Just copy, paste, and run!
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
  ],

  // Finish step
  FINISH: [
    {
      target: 'body',
      content: (
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem' }}>🎉 You're All Set!</h2>
          <p style={{ margin: 0, opacity: 0.9 }}>
            You've completed the tour! Here's what to do next:
          </p>
          <ol style={{ margin: '12px 0', paddingLeft: 24, textAlign: 'left', opacity: 0.85, fontSize: '0.9rem' }}>
            <li>Add a database connection</li>
            <li>Explore the auto-generated APIs</li>
            <li>Build custom endpoints with the API Builder</li>
            <li>Use the ER diagram to visualize relationships</li>
          </ol>
          <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Click the <strong>?</strong> button in the header anytime to restart this tour or get help.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ],
};

// Context
const TourContext = createContext(null);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export const TourProvider = ({ children }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourType, setTourType] = useState(null);
  const [currentTourPage, setCurrentTourPage] = useState(null);

  // Check if tour should auto-start for new users
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY);
    const dontShow = localStorage.getItem(TOUR_DONT_SHOW_KEY);
    
    if (!hasCompletedTour && !dontShow && location.pathname === '/dashboard') {
      // Small delay to let the page render
      const timer = setTimeout(() => {
        startFullTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Joyride styles matching app theme
  const joyrideStyles = {
    options: {
      arrowColor: theme.palette.background.paper,
      backgroundColor: theme.palette.background.paper,
      overlayColor: alpha(theme.palette.common.black, 0.75),
      primaryColor: theme.palette.primary.main,
      textColor: theme.palette.text.primary,
      zIndex: 10000,
    },
    tooltip: {
      borderRadius: 12,
      padding: 20,
      boxShadow: theme.shadows[16],
      maxWidth: 420,
    },
    tooltipContainer: {
      textAlign: 'left',
    },
    tooltipTitle: {
      fontSize: 18,
      fontWeight: 600,
    },
    tooltipContent: {
      fontSize: 14,
      lineHeight: 1.6,
    },
    buttonNext: {
      backgroundColor: theme.palette.primary.main,
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 14,
      fontWeight: 600,
    },
    buttonBack: {
      color: theme.palette.text.secondary,
      marginRight: 8,
    },
    buttonSkip: {
      color: theme.palette.text.secondary,
    },
    buttonClose: {
      color: theme.palette.text.secondary,
    },
    beacon: {
      inner: theme.palette.primary.main,
      outer: alpha(theme.palette.primary.main, 0.3),
    },
    spotlight: {
      borderRadius: 8,
    },
  };

  // Build full tour steps with page navigation
  const buildFullTourSteps = useCallback(() => {
    return [
      ...TOUR_STEPS.WELCOME,
      ...TOUR_STEPS.SIDEBAR,
      ...TOUR_STEPS.NAVIGATION,
      // Dashboard steps with page marker
      ...TOUR_STEPS.DASHBOARD.map(step => ({ ...step, _page: '/dashboard' })),
      // Schema steps with page marker
      ...TOUR_STEPS.SCHEMA.map(step => ({ ...step, _page: '/schema' })),
      // ER Diagram steps with page marker
      ...TOUR_STEPS.ER_DIAGRAM.map(step => ({ ...step, _page: '/er-diagram' })),
      // APIs steps with page marker
      ...TOUR_STEPS.APIS.map(step => ({ ...step, _page: '/apis' })),
      ...TOUR_STEPS.FINISH,
    ];
  }, []);

  // Start full guided tour
  const startFullTour = useCallback(() => {
    const fullSteps = buildFullTourSteps();
    setSteps(fullSteps);
    setStepIndex(0);
    setTourType('full');
    setCurrentTourPage('/dashboard');
    setRun(true);
  }, [buildFullTourSteps]);

  // Start page-specific tour
  const startPageTour = useCallback((page) => {
    let pageSteps = [];
    switch (page) {
      case 'dashboard':
        pageSteps = TOUR_STEPS.DASHBOARD;
        break;
      case 'schema':
        pageSteps = TOUR_STEPS.SCHEMA;
        break;
      case 'er-diagram':
        pageSteps = TOUR_STEPS.ER_DIAGRAM;
        break;
      case 'apis':
        pageSteps = TOUR_STEPS.APIS;
        break;
      case 'api-builder':
        pageSteps = TOUR_STEPS.API_BUILDER;
        break;
      case 'api-tester':
        pageSteps = TOUR_STEPS.API_TESTER;
        break;
      default:
        return;
    }
    setSteps(pageSteps);
    setStepIndex(0);
    setTourType('page');
    setCurrentTourPage(page);
    setRun(true);
  }, []);

  // Start specific section tour
  const startSectionTour = useCallback((sectionSteps) => {
    if (sectionSteps && sectionSteps.length > 0) {
      setSteps(sectionSteps);
      setStepIndex(0);
      setTourType('section');
      setRun(true);
    }
  }, []);

  // Stop tour
  const stopTour = useCallback(() => {
    setRun(false);
    setSteps([]);
    setStepIndex(0);
    setTourType(null);
    setCurrentTourPage(null);
  }, []);

  // Reset tour (allow it to show again)
  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(TOUR_DONT_SHOW_KEY);
  }, []);

  // Mark tour as completed
  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }, []);

  // Skip tour permanently
  const skipTourPermanently = useCallback(() => {
    localStorage.setItem(TOUR_DONT_SHOW_KEY, 'true');
    stopTour();
  }, [stopTour]);

  // Handle Joyride callback
  const handleJoyrideCallback = useCallback((data) => {
    const { action, index, status, type, step } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      if (status === STATUS.FINISHED && tourType === 'full') {
        completeTour();
      }
    } else if (type === EVENTS.STEP_AFTER) {
      // Check if next step requires navigation
      const nextStep = steps[index + 1];
      if (nextStep?._page && nextStep._page !== location.pathname) {
        navigate(nextStep._page);
        // Small delay to let the page render
        setTimeout(() => {
          setStepIndex(index + 1);
        }, 500);
        return;
      }

      // Move to next step
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        // Check if prev step requires navigation
        const prevStep = steps[index - 1];
        if (prevStep?._page && prevStep._page !== location.pathname) {
          navigate(prevStep._page);
          setTimeout(() => {
            setStepIndex(index - 1);
          }, 500);
          return;
        }
        setStepIndex(index - 1);
      }
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // Skip to next step if target not found
      console.warn(`Tour target not found: ${step?.target}`);
      setStepIndex(index + 1);
    }
  }, [tourType, completeTour, steps, location.pathname, navigate]);

  const value = {
    run,
    steps,
    stepIndex,
    tourType,
    currentTourPage,
    startFullTour,
    startPageTour,
    startSectionTour,
    stopTour,
    resetTour,
    completeTour,
    skipTourPermanently,
    isTourCompleted: !!localStorage.getItem(TOUR_STORAGE_KEY),
    TOUR_STEPS, // Expose steps for custom use
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        spotlightClicks
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={joyrideStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Tour',
        }}
        floaterProps={{
          disableAnimation: false,
        }}
      />
    </TourContext.Provider>
  );
};

export default TourProvider;
