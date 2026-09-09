pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '5'))
    timeout(time: 15, unit: 'MINUTES')
    timestamps()
  }

  environment {
    CI = 'true'
    NODE_OPTIONS = '--max-old-space-size=384'
    PATH = '/usr/local/bin:/usr/bin:/bin'
  }

  stages {
    stage('Obter código-fonte') {
      steps {
        checkout scm
      }
    }

    stage('Instalar dependências') {
      steps {
        sh 'pnpm install --frozen-lockfile --prefer-offline'
      }
    }

    stage('Validar e compilar') {
      steps {
        sh 'pnpm run check'
      }
    }

    stage('Implantar') {
      steps {
        sh 'sudo /usr/local/sbin/deploy-gestaolife'
      }
    }
  }

  post {
    success {
      echo 'Gestão Life validado e implantado com sucesso.'
    }
    failure {
      echo 'A implantação falhou. Consulte as etapas acima para identificar a causa.'
    }
  }
}
