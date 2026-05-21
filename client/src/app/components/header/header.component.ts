import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-gray-800 text-center text-2xl sm:text-3xl font-bold mb-2">Major League Soccer Today</h1>
  `
})
export class HeaderComponent {}
