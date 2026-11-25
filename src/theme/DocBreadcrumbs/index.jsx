import React from 'react';
// @theme-init is the theme-classic breadcrumbs. Theme components of two
// plugins do not chain, so this row replaces the one of
// @stackql/docusaurus-plugin-aeo (the plugin checks that it loads after it)
// and renders its Ask AI button itself, through an alias that
// configureWebpack points at @theme/AskAiButton or at a component that
// renders nothing.
import DocBreadcrumbs from '@theme-init/DocBreadcrumbs';
import AskAiButton from '@stackql-deploy-template/AskAiButton';
import StackqlDeployTemplate from '@theme/StackqlDeployTemplate';
import styles from './styles.module.css';

/**
 * The breadcrumb row of a doc page: the breadcrumbs on the left, the page
 * actions on the right (Ask AI, then the stackql-deploy template menu on a
 * resource page), the same position as the Ask AI button on stackql.io.
 */
export default function DocBreadcrumbsWrapper(props) {
  return (
    <div className={styles.row}>
      <DocBreadcrumbs {...props} />
      <div className={styles.actions}>
        <AskAiButton />
        <StackqlDeployTemplate />
      </div>
    </div>
  );
}
