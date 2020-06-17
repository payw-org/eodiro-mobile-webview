import 'react-native-gesture-handler'

import * as Notifications from 'expo-notifications'
import * as ScreenOrientation from 'expo-screen-orientation'

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MessageData, NotificationsStatus } from './src/types'
import React, { useEffect, useRef, useState } from 'react'
import WebView, { WebViewNavigation } from 'react-native-webview'
import {
  checkNotifications,
  requestNotifications,
} from 'react-native-permissions'

import { AppStatus } from './src/modules/app-status'
import Config from './config'
import Constants from 'expo-constants'
import DeviceInfo from 'react-native-device-info'
import URL from 'url-parse'
import { enableScreens } from 'react-native-screens'
import { oneApiClient } from '@payw/eodiro-one-api'
import { useDarkMode } from 'react-native-dark-mode'

enableScreens()

function setNavBarTextColor(isDarkMode: boolean) {
  if (isDarkMode) {
    StatusBar.setBarStyle('light-content', true)
    AppStatus.currentStatusBarStyle = 'light-content'
  } else {
    StatusBar.setBarStyle('dark-content', true)
    AppStatus.currentStatusBarStyle = 'dark-content'
  }
}

export default function App() {
  const [isNotificationsGranted, setIsNotificationsGranted] = useState(false)

  const [url, setUrl] = useState('https://eodiro.com')

  const isDarkMode = useDarkMode()

  const [isLoaded, setIsLoaded] = useState(false)
  const [isNavScrolled, setIsNavScrolled] = useState(false)
  const webView = useRef<WebView>()
  const [currentUrl, setCurrentUrl] = useState(url)

  useEffect(() => {
    setTimeout(() => {
      setNavBarTextColor(isDarkMode)
    }, 1200)
  }, [isDarkMode])

  useEffect(() => {
    async function init() {
      // Programmatically set the status bar style to white text
      setNavBarTextColor(isDarkMode)

      let finalStatus: NotificationsStatus

      const { status: existingStatus } = await checkNotifications()

      finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await requestNotifications([
          'alert',
          'sound',
          'badge',
        ])

        finalStatus = status
      }

      if (finalStatus === 'granted') {
        setIsNotificationsGranted(true)
      }

      // Foreground notifications
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      })

      // On tap an notification
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data
        const body = data.body as Record<string, any>

        if (body.type === 'notice') {
          Linking.openURL(body.url)
        }
      })

      Keyboard.addListener('keyboardWillShow', () => {
        StatusBar.setBarStyle(AppStatus.currentStatusBarStyle)
      })

      Keyboard.addListener('keyboardDidHide', () => {
        StatusBar.setBarStyle(AppStatus.currentStatusBarStyle)
      })
    }

    init()
  }, [])

  return (
    <>
      <View
        style={{
          height: Constants.statusBarHeight,
          backgroundColor:
            isDarkMode && isNavScrolled
              ? '#1f1f1f'
              : isDarkMode && !isNavScrolled
              ? '#000'
              : isNavScrolled
              ? '#fff'
              : '#f0f2f3',
        }}
      />
      <WebView
        ref={(wv) => {
          webView.current = wv as WebView
        }}
        source={{
          uri: 'https://eodiro.com',
        }}
        decelerationRate="normal"
        onMessage={async ({ nativeEvent }) => {
          let data: MessageData
          try {
            data = JSON.parse(nativeEvent.data)
          } catch (error) {
            return
          }

          const { key, authProps, apiHost } = data

          if (key === 'auth') {
            if (new URL(currentUrl).pathname !== '/') {
              return
            }

            if (!authProps?.isSigned) return

            const deviceId = DeviceInfo.getUniqueId()

            let pushToken = ''

            if (Constants.isDevice) {
              const { data } = await Notifications.getExpoPushTokenAsync({
                experienceId: Config.experienceId,
              })
              pushToken = data
            }

            if (!pushToken) {
              Alert.alert('에러', '푸시 알림 토큰을 가져올 수 없습니다.')
              return
            }

            const result = await oneApiClient(apiHost, {
              action: 'addDevice',
              data: {
                deviceId,
                pushToken,
                accessToken: authProps.tokens.accessToken as string,
              },
            })

            if (result.err) {
              console.log(result.err)
              Alert.alert(
                '기기 등록에 문제가 발생했습니다.',
                `ERR: ${result.err}`
              )
            }
          } else if (key === 'goBack') {
            webView.current?.goBack()
          }
        }}
        onNavigationStateChange={(e) => {
          setCurrentUrl(e.url)
        }}
      />
    </>
  )
}

const arrowSize = 35
