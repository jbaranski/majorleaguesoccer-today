import { Component, input } from '@angular/core';

@Component({
  selector: 'app-last-updated',
  imports: [],
  template: ``
})
export class LastUpdatedComponent {
  date = input.required<string>();
}
