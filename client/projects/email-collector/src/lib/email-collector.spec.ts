import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailCollector } from './email-collector';

describe('EmailCollector', () => {
  let component: EmailCollector;
  let fixture: ComponentFixture<EmailCollector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailCollector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailCollector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
