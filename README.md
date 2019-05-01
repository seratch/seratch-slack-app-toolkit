# seratch-slack-app-toolkit

This module is a useful toolkit to build Slack Apps in TypeScript. It depends on:

* seratch-slack-types
* express

# Code Examples

## Express App

The following is a minimum example which runs on both AWS Lambda and Google Cloud Functions.

### handler.ts

```typescript
import * as express from 'express';
import { Express, Request, Response } from 'express';
import * as bodyParser from 'body-parser';

import * as Slack from '@slack/web-api';
import { WebApi as W, EventsApi as E } from 'seratch-slack-types';
import { EventsApiOperator, EventsApiOperation as Op, EventsApiOperationArgs as OpArgs } from 'seratch-slack-app-toolkit';

export const slack = new Slack.WebClient(process.env.SLACK_API_TOKEN);

// Express app
export const app: Express = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Events Operator
const operator = new EventsApiOperator();
operator.add('reaction_added', new Op<E.ReactionAddedPayload>(
  // EventsApiOperationArgs contains payload, request, response
  function (args: OpArgs<E.ReactionAddedPayload>) {
    // Return 200 OK right away
    return res.status(200).json({ ok: true });
  }
));

app.post('/events', function (req: Request, res: Response) {
  operator.dispatch(req.body, req, res);
});

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
