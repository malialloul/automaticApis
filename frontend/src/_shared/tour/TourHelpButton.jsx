import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  alpha,
  Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import SchemaIcon from '@mui/icons-material/Schema';
import ApiIcon from '@mui/icons-material/Api';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTour } from './TourProvider';
import { useLocation } from 'react-router-dom';

const TourHelpButton = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const { startFullTour, startPageTour, resetTour, isTourCompleted } = useTour();
  const location = useLocation();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFullTour = () => {
    handleClose();
    startFullTour();
  };

  const handlePageTour = (page) => {
    handleClose();
    startPageTour(page);
  };

  const handleResetTour = () => {
    handleClose();
    resetTour();
    // Small delay then start
    setTimeout(() => {
      startFullTour();
    }, 100);
  };

  // Determine current page
  const getCurrentPage = () => {
    if (location.pathname.includes('dashboard')) return 'dashboard';
    if (location.pathname.includes('schema')) return 'schema';
    if (location.pathname.includes('er-diagram')) return 'er-diagram';
    if (location.pathname.includes('db-apis')) return 'apis';
    return null;
  };

  const currentPage = getCurrentPage();

  return (
    <>
      <Tooltip title="Help & Tour">
        <IconButton
          onClick={handleClick}
          color="inherit"
          data-tour="help-button"
          sx={{
            position: 'relative',
            '&::after': !isTourCompleted ? {
              content: '""',
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'warning.main',
              animation: 'pulse 2s infinite',
            } : {},
            '@keyframes pulse': {
              '0%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.5, transform: 'scale(1.2)' },
              '100%': { opacity: 1, transform: 'scale(1)' },
            },
          }}
        >
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: 240,
            borderRadius: 2,
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            🎓 Interactive Tours
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Learn how to use Prism
          </Typography>
        </Box>

        <Divider />

        <MenuItem onClick={handleFullTour}>
          <ListItemIcon>
            <AutoAwesomeIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText 
            primary="Full App Tour" 
            secondary="Complete walkthrough"
            primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
            secondaryTypographyProps={{ fontSize: 12 }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ px: 2, py: 0.5, display: 'block' }}
        >
          Page Tours
        </Typography>

        <MenuItem 
          onClick={() => handlePageTour('dashboard')}
          disabled={currentPage !== 'dashboard'}
        >
          <ListItemIcon>
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Dashboard Tour" />
        </MenuItem>

        <MenuItem 
          onClick={() => handlePageTour('schema')}
          disabled={currentPage !== 'schema'}
        >
          <ListItemIcon>
            <SchemaIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Schema Tour" />
        </MenuItem>

        <MenuItem 
          onClick={() => handlePageTour('er-diagram')}
          disabled={currentPage !== 'er-diagram'}
        >
          <ListItemIcon>
            <MapIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="ER Diagram Tour" />
        </MenuItem>

        <MenuItem 
          onClick={() => handlePageTour('apis')}
          disabled={currentPage !== 'apis'}
        >
          <ListItemIcon>
            <ApiIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="APIs Tour" />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleResetTour}>
          <ListItemIcon>
            <RefreshIcon fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText 
            primary="Restart Tour" 
            secondary="Reset and start over"
            primaryTypographyProps={{ fontSize: 14 }}
            secondaryTypographyProps={{ fontSize: 12 }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default TourHelpButton;
