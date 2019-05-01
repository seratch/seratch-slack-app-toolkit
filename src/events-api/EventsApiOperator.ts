import { Request, Response } from 'express';
import { EventsApiOperation } from './EventsApiOperation';
import { EventsApiOperationArgs } from './EventsApiOperationArgs';
import { EventsApiPayload } from './EventsApiPayload';

export class EventsApiOperator {
  private eventTypeAndOperations: { [typeName: string]: EventsApiOperation<EventsApiPayload>[] } = {};

  add<E extends EventsApiPayload>(type: string, operation: EventsApiOperation<E>): void {
    let operations: EventsApiOperation<EventsApiPayload>[] = this.eventTypeAndOperations[type];
    if (operations) {
      operations.push(operation as EventsApiOperation<EventsApiPayload>);
    } else {
      operations = [operation as EventsApiOperation<EventsApiPayload>];
    }
    this.eventTypeAndOperations[type] = operations;
  }

  removeAll(type: string): void {
    this.eventTypeAndOperations[type] = [];
  }

  dispatch(payload: EventsApiPayload, request: Request, response: Response) {
    if (payload.type === 'url_verification') {
      // https://api.slack.com/events/url_verification
      if (payload.challenge) {
        response.status(200).write(payload.challenge);
      } else {
        // invalid payload
        response.status(400).json({ ok: false });
      }
    } else if (payload.type && payload.type === 'event_callback') {
      if (payload.event && payload.event.type) {
        const operation = this.eventTypeAndOperations[payload.event.type];
        if (operation) {
          operation.forEach(operation => {
            operation.run(new EventsApiOperationArgs(payload, request, response));
          });
        } else {
          console.log(`No operations registered for type: ${payload.event.type}`)
        }
      } else {
        response.status(400).json({ ok: false });
      }
    }
  }
}
