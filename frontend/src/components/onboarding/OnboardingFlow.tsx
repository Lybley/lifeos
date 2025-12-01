'use client';

import React, { useState } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { ConnectGmailStep } from './ConnectGmailStep';
import { IngestStep } from './IngestStep';
import { TutorialStep } from './TutorialStep';

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export const OnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [ingestComplete, setIngestComplete] = useState(false);

  const steps = [
    { component: WelcomeStep, title: 'Welcome', props: {} },
    { 
      component: ConnectGmailStep, 
      title: 'Connect Gmail',
      props: { 
        onConnected: () => setGmailConnected(true),
        connected: gmailConnected,
      }
    },
    { 
      component: IngestStep, 
      title: 'Ingest Data',
      props: {
        onComplete: () => setIngestComplete(true),
        complete: ingestComplete,
      }
    },
    { component: TutorialStep, title: 'First Query', props: {} },
  ];

  const handleNext = () => {
    setCompletedSteps([...completedSteps, currentStep]);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Onboarding complete - redirect to dashboard
      window.location.href = '/';
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;
  const currentStepProps = steps[currentStep].props;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                    index <= currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  } ${completedSteps.includes(index) ? 'ring-4 ring-green-200' : ''}`}
                >
                  {completedSteps.includes(index) ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-2 rounded-full mx-2 transition-colors ${
                      index < currentStep
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-4">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </p>
        </div>

        {/* Current Step */}
        <CurrentStepComponent onNext={handleNext} onBack={handleBack} {...currentStepProps} />
      </div>
    </div>
  );
};
