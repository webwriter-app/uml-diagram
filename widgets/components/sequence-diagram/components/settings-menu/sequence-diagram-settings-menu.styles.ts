import { css } from "lit";

export default css`

  /**
   * Styles for the Class Settings Menu component.
   * Defines the layout for the configuration sidebar, including 
   * the container structure, accordion styling (Shoelace details), 
   * and the arrangement of switches and inputs.
   */

  /* -------------------------------------------------------------------------- */
  /* Main Container for the settings menu                                       */
  /* -------------------------------------------------------------------------- */

  /* Defines the host element as a vertical flex container to stack options */
  :host {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 5px;
    font-family: var(--sl-font-sans);
  }

  /* -------------------------------------------------------------------------- */
  /* Sl Details stylings                                                        */
  /* -------------------------------------------------------------------------- */

  sl-details {
    border: none;         
    background: transparent;     
    margin-bottom: 0px; 
  }

  sl-details.options-group {
    border: 1px solid transparent;
    border-radius: 5px;
    background-color: transparent;
    padding: 0px;
  }

  sl-details::part(base) {
    border: none;
    background-color: transparent;
  }

  sl-details::part(header) {
    padding: 2px 0;
    min-height: 25px;
  }

  sl-details::part(header):hover {
    background-color: var(--sl-color-neutral-100);
    border-radius: 4px;
  }

  sl-details::part(summary) {
    font-weight: normal;  
    font-size: 0.8em;      
  }
  
  sl-details::part(summary-icon) {
    font-size: 12px;     
    margin-right: 5px; 
  }
  
  sl-details::part(content) {
    padding: 2px 0 2px 12px; 
  }

  /* -------------------------------------------------------------------------- */
  /* Layout for the content inside                                              */
  /* -------------------------------------------------------------------------- */

  /* Layout for the list of switches inside an opened accordion */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px; 
    padding-left: 10px;
    padding-bottom: 5px;
  }

  /* Basic container for individual option items */
  .optionsItem {
    padding: 5px;
    border: 1px solid transparent;
    background-color: transparent;
  }

  /* define where the tooltip is displayed */
  sl-tooltip {
    display: block;
    width: 100%;
    --max-width: 220px;
  }

  /* style the tooltip */
  sl-tooltip::part(body) {
    background-color: var(--sl-color-primary-900);
    color: var(--sl-color-primary-50);
    font-size: var(--sl-font-size-x-small);
    font-family: var(--sl-font-sans);
    border-radius: 4px;
    padding: 4px 8px;
  }

  /* style the tooltip arrow the same way as the rest of the tooltip */
  sl-tooltip::part(base__arrow) {
    background-color: var(--sl-color-primary-900);
  }
`;