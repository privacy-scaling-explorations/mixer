import React from 'react'
import Select from 'react-select'

const configMixer = require('../../exported_config')
import {
    setNetwork,
    network,
} from '../utils/configFrontend'

function mapOption(value) {
  return {value: value, label: configMixer.network[value].supportedNetworkName};
}

const options = Object.keys(configMixer.network).map(mapOption)

const customStyles = {
  control: () => ({
    // none of react-select's styles are passed to <Control />
    width: "10em",
  }),
}

class NetworkSelect extends React.Component {

    state = {
            selectedOption: mapOption(network),
        }

    handleChange = selectedOption => {
            this.setState({ selectedOption })
            setNetwork(selectedOption.value)
        };

    render = () => {

        const { selectedOption } = this.state

        return (
            <div style={{width: '10em'}}>
                <Select
                    style={customStyles}
                    value={selectedOption}
                    onChange={this.handleChange}
                    options={options}
                    />
            </div>
            )
        }
}

export default NetworkSelect
