import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';
// CommonJS, shared with the tests.
import templateModule from '../../template.js';
import extractModule from '../../extract.js';

const { buildTemplate, resourceNameFor, DEFAULT_RESOURCE_ROUTE } = templateModule;
const { extractSections } = extractModule;

const PLUGIN_NAME = '@stackql/docusaurus-plugin-stackql-deploy-template';

// The same outlined pill as the Ask AI button of @stackql/docusaurus-plugin-aeo,
// so the two read as one group in the breadcrumb row.
const BUTTON_SX = {
  textTransform: 'none',
  fontFamily: 'var(--ifm-font-family-base)',
  fontWeight: 600,
  fontSize: '0.75rem',
  borderColor: 'var(--ifm-color-primary)',
  color: 'var(--ifm-color-primary)',
  '&:hover': {
    borderColor: 'var(--ifm-color-primary)',
    backgroundColor: 'color-mix(in srgb, var(--ifm-color-primary) 4%, transparent)',
  },
};

const ITEM_TEXT_PROPS = {
  fontSize: '0.85rem',
  fontFamily: 'var(--ifm-font-family-base)',
};

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text));
  }
  copyWithTextarea(text);
  return Promise.resolve();
}

// Fallback for browsers or contexts without the async clipboard API.
function copyWithTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The stackql-deploy template menu of a provider resource page: Download
 * saves <resource>.iql, Copy puts the same template on the clipboard. The
 * template is built from the page's SQL examples when the reader picks an
 * item. Renders nothing on pages that are not resource pages.
 */
export default function StackqlDeployTemplate() {
  const data = usePluginData(PLUGIN_NAME) || {};
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [copied, setCopied] = useState(false);
  const open = Boolean(anchorEl);

  const resourceName = resourceNameFor(location.pathname, data.resourceRoute || DEFAULT_RESOURCE_ROUTE);
  if (!resourceName) return null;

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const template = () => buildTemplate(extractSections(document));

  const handleDownload = () => {
    const text = template();
    if (text) download(text, `${resourceName}.iql`);
    handleClose();
  };

  const handleCopy = () => {
    const text = template();
    if (text) {
      copyText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
    handleClose();
  };

  const wrapperClass = data.showOnMobile ? styles.wrapperAllViewports : styles.wrapper;

  return (
    <div className={wrapperClass}>
      <Button
        variant="outlined"
        size="small"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={BUTTON_SX}
      >
        {translate({
          id: 'stackqlDeployTemplate.button',
          message: 'stackql-deploy Template',
          description: 'Label of the stackql-deploy template dropdown button on a resource page',
        })}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{
          '& .MuiPaper-root': {
            fontFamily: 'var(--ifm-font-family-base)',
            minWidth: 180,
          },
        }}
      >
        <MenuItem onClick={handleDownload}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={ITEM_TEXT_PROPS}>
            {translate({
              id: 'stackqlDeployTemplate.download',
              message: 'Download',
              description: 'stackql-deploy template menu entry that saves the template as a .iql file',
            })}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={ITEM_TEXT_PROPS}>
            {copied
              ? translate({
                  id: 'stackqlDeployTemplate.copied',
                  message: 'Copied!',
                  description: 'stackql-deploy template menu entry, shown after the template was copied',
                })
              : translate({
                  id: 'stackqlDeployTemplate.copy',
                  message: 'Copy',
                  description: 'stackql-deploy template menu entry that copies the template to the clipboard',
                })}
          </ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );
}
