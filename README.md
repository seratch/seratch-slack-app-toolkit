# seratch-slack-app-toolkit

This module is a useful toolkit to build Slack Apps in TypeScript. It depends on:

* seratch-slack-types
* express

# Code Examples

## Express App

The following is a minimum example which runs on both AWS Lambda and Google Cloud Functions.

### app.ts

```typescript
//
// A TypeScript implementation of https://github.com/slackapi/reacjilator
//
// Author: Kazuhiro Sera @seratch
// MIT License as with the original code
//

// express
import * as express from 'express';
import { Express, Request, Response } from 'express';
import * as bodyParser from 'body-parser';

// Slack
import * as Slack from '@slack/web-api';

import * as SlackWebApi from 'seratch-slack-types/web-api';
type ConversationsReplies = SlackWebApi.ConversationsRepliesResponse;
type ChatPostMessage = SlackWebApi.ChatPostMessageResponse;

import * as SlackEventsApi from 'seratch-slack-types/events-api';
type ReactionAdded = SlackEventsApi.ReactionAddedPayload;

import * as SlackAppToolkit from 'seratch-slack-app-toolkit';
const Op = SlackAppToolkit.EventsApi.EventsApiOperation;
type OpArgs<A> = SlackAppToolkit.EventsApi.EventsApiOperationArgs<A>;

export const slackApi = new Slack.WebClient(process.env.SLACK_API_TOKEN);
const slackEventsOperator = new SlackAppToolkit.EventsApi.EventsApiOperator();

// Express app
export const app: Express = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Google Translate API
import { Translate as GoogleTranslateApi } from '@google-cloud/translate';
// https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials?project={Project ID}
// $ export GOOGLE_PROJECT_ID={Project ID}
// $ export GOOGLE_KEY={API Key}
const googleApiCredentials = {
  projectId: process.env.GOOGLE_PROJECT_ID,
  key: process.env.GOOGLE_KEY
}
const googleApi: GoogleTranslateApi = new GoogleTranslateApi(googleApiCredentials);

// Enable debug logging if true
const debug: boolean = true;
// lang code mapping data
import { langcode } from './langcode';

slackEventsOperator.add('reaction_added', new Op<ReactionAdded>(
  function (args: OpArgs<ReactionAdded>) {
    const payload = args.payload;
    const res = args.response;
    if (debug) {
      console.log(payload.event);
    }
    if (payload.event.item.type !== 'message') {
      // Skip any events apart from reactions put on messages
      return res.status(200);
    }
    const reactionName = payload.event.reaction;
    let country: string = null;
    // Check the reaction name if it is a country flag
    if (reactionName.match(/flag-/)) { // when the name has flag- prefix
      country = reactionName.match(/(?!flag-\b)\b\w+/)[0];
    } else { // jp, fr, etc.
      const flags = Object.keys(langcode.All); // array
      if (flags.includes(reactionName)) {
        country = reactionName;
      } else {
        return res.status(200);
      }
    }
    // Finding a lang based on a country is not the best way but oh well
    // Matching ISO 639-1 language code
    const lang: string = langcode.All[country];
    if (!lang) {
      return res.status(200);
    }
    if (debug) {
      console.log(`Detected country: ${country}, lang: ${lang} from reaction: ${reactionName}`);
    }

    const channelId: string = payload.event.item.channel;
    const messageTs: string = payload.event.item.ts;

    // Fetch all the messages in the thread
    slackApi.conversations.replies({
      channel: channelId,
      ts: messageTs,
      inclusive: true
    }) // The returned value is a Promise - chaining operations started here
      .then((repliesRes: ConversationsReplies) => {
        if (debug) {
          console.log(repliesRes.messages);
        }
        const messages = repliesRes.messages;
        const message = messages[0];
        if (message.text) {
          // Call Google Translate API to get a translated text
          googleApi.translate(message.text, lang)
            .then((array) => {
              const [translatedText, googleApiRes] = array; // [string, r.Response]
              if (debug) {
                console.log(`Response from Google Translate API: ${JSON.stringify(googleApiRes)}`);
              }

              // To avoid posting same messages several times, make sure if a same message in the thread doesn't exist
              let alreadyPosted: boolean = false;
              messages.forEach(messageInTheThread => {
                if (!alreadyPosted && messageInTheThread.text && messageInTheThread.text === translatedText) {
                  alreadyPosted = true;
                }
              });
              if (alreadyPosted) {
                return;
              }

              // Post the translated text as a following message in the thread
              slackApi.chat.postMessage({
                channel: channelId,
                text: translatedText,
                as_user: false,
                username: "Reacjilator Bot",
                thread_ts: message.thread_ts ? message.thread_ts : message.ts
              })
                .then((postRes: ChatPostMessage) => {
                  if (postRes.ok) {
                    console.log(`Successfully posted a translated message (ts: ${postRes.ts})`);
                  } else {
                    if (debug) {
                      console.error(postRes);
                    }
                    console.error(`Got an error from chat.postMessage (error: ${postRes.error})`);
                  }
                })
                .catch(reason => {
                  console.error(`Failed to post a message because ${reason}`);
                })

            })
            .catch(reason => {
              console.error(`Failed to call Google Translate API because ${reason}`);
            })

          } else {
          console.log(`Skipped the message because it doesn't have text property (ts: ${message.ts})`);
        }
      })
      .catch(reason => {
        console.error(`Failed to fetch message replies because ${reason}`);
      });

    // Return 200 OK right away
    return res.status(200).json({ ok: true });
  }
));

app.post('/events', function (req: Request, res: Response) {
  slackEventsOperator.dispatch(req.body, req, res);
});
```

### handler.ts

```typescript
import 'source-map-support/register';
import { app } from './app';
export const dispatcher = require('serverless-http')(app);
```

### serverless.yml

```yaml
service:
  name: awesome-app
plugins:
  - serverless-offline
  - serverless-webpack
provider:
  name: aws
  runtime: nodejs8.10
functions:
  dispatcher:
    handler: handler.dispatcher
    events:
      - http:
          method: post
          path: /events
```
