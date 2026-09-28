import { IncomingWebhook } from '@slack/webhook';


export const sendErrorToSlack = (error, context = {}) => {
  // Skip in non-production environments
  if (process.env.NODE_ENV !== 'production' || !process.env.SLACK_WEBHOOK_URL) {
    console.error('Error:', error, 'Context:', context);
    return;
  }

  try {
    const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    
    const slackMessage = {
      text: '🚨 API Error Notification',
      attachments: [{
        color: '#ff0000',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error Message:*\n${error.message || 'No message provided'}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Status Code:*\n${error.statusCode || '500'}`
              },
              {
                type: 'mrkdwn',
                text: `*Environment:*\n${process.env.NODE_ENV}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Stack Trace:*\n\`\`\`${error.stack || 'No stack trace'}\`\`\``
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Additional Context:*\n\`\`\`${JSON.stringify(context, null, 2) || 'No additional context'}\`\`\``
            }
          }
        ]
      }]
    };

    webhook.send(slackMessage).catch(slackError => {
      console.error('Failed to send Slack notification:', slackError);
    });
  } catch (setupError) {
    console.error('Slack webhook setup failed:', setupError);
  }
};
