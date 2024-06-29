import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import '@tensorflow/tfjs-backend-cpu';
import { initNotifications, notify } from '@mycv/f8-notification';
import soundURL from './assets/botayra.mp3';
import { Howl } from 'howler';
const mobilenet = require('@tensorflow-models/mobilenet');
const knnClassifier = require('@tensorflow-models/knn-classifier');

const sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'not_touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCES = 0.8;

function App() {
  const video = useRef();
  const mobileModel = useRef();
  const classifier = useRef();
  const canPlaySound = useRef(true);
  const [touched, setTouched] = useState(false);

  const init = async () => {
    await setupCamera();
    console.log('Dang setup Camera');
    classifier.current = knnClassifier.create();
    mobileModel.current = await mobilenet.load();
    console.log('Setup camera thanh cong')
    initNotifications({ cooldown: 3000 });
  };

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve);
          },
          error => reject(error)
        );
      } else {
        reject();
      }
    });
  };

  const train = async label => {
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log(`Progress ${parseInt((i + 1) / TRAINING_TIMES * 100)}%`);
      await training(label);
    }
  };

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobileModel.current.infer(video.current, true);
      classifier.current.addExample(embedding, label);
      await sleep(50);
      resolve();
    });
  };

  const run = async () => {
    try {
      const embedding = mobileModel.current.infer(video.current, true);
      const result = await classifier.current.predictClass(embedding);

      if (result.label === TOUCHED_LABEL && result.confidences[result.label] > TOUCHED_CONFIDENCES) {
        console.log("TOUCHED");
        if (canPlaySound.current) {
          canPlaySound.current = false;
          sound.play();
        }
        notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay vô mặt!' });
        setTouched(true);
      } else {
        console.log("NOT TOUCH");
        setTouched(false);
      }

      await sleep(200);
      run();
    } catch (error) {
      console.log(error);
    }
  };

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  useEffect(() => {
    init();

    sound.on('end', function () {
      canPlaySound.current = true;
    });

    return () => {
      //Dừng luồng trách việc camera hoạt động ngầm
      if (video.current && video.current.srcObject) {
        video.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='background-main'>
      <div className={`main ${touched ? 'touch' : ''}`}>
      <video
        ref={video}
        className='video'
        autoPlay
      />
      <div className='control'>
        <button className='btn' onClick={() => train(NOT_TOUCH_LABEL)}>Button 1</button>
        <button className='btn' onClick={() => train(TOUCHED_LABEL)}>Button 2</button>
        <button className='btn' onClick={run}>Run</button>
      </div>
    </div>
    </div>
  );
}

export default App;
