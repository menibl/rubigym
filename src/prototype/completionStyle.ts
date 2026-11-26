// Presentation only: final actions differ from gold navigation/selection controls.
export const completionStyle=`
.staging-logic-chat button.logic-complete,
.staging-logic-chat .logic-form[data-chat-final-step=true] button[type=submit]{background:#176b50!important;color:#ffffff!important;border:2px solid #72d6a7!important;box-shadow:0 0 0 1px #176b5066}
.staging-logic-chat button.logic-complete small,
.staging-logic-chat button.logic-complete svg{color:#ffffff!important}
.staging-logic-chat button.logic-complete:not(:disabled):hover,
.staging-logic-chat .logic-form[data-chat-final-step=true] button[type=submit]:not(:disabled):hover{background:#12543f!important}
.staging-logic-chat button.logic-complete:focus-visible,
.staging-logic-chat .logic-form[data-chat-final-step=true] button[type=submit]:focus-visible{outline:3px solid #8bf0bf;outline-offset:4px}
.staging-logic-chat button.logic-complete:disabled{opacity:.45;cursor:not-allowed}
`;
